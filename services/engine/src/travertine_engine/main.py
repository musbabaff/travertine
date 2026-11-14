"""FastAPI application implementing `packages/contract/openapi.yaml` (v1)."""

from __future__ import annotations

import logging
import math
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from travertine_engine import __version__
from travertine_engine.cache import DiskCache
from travertine_engine.config import Settings
from travertine_engine.errors import EngineError, RateLimited
from travertine_engine.field import FieldService
from travertine_engine.logs import configure_logging, request_id_var
from travertine_engine.models import Crop, ErrorBody, FieldAnalysis, FieldAnalyzeRequest, Health
from travertine_engine.ratelimit import RateLimiter
from travertine_engine.science.crops import load_crops
from travertine_engine.upstream import Upstream

log = logging.getLogger("travertine_engine")

ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    "422": {"model": ErrorBody},
    "default": {"model": ErrorBody},
}


def create_app(settings: Settings | None = None, upstream: Upstream | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        client = upstream or Upstream(
            timeout_s=settings.upstream_timeout_s, retries=settings.upstream_retries
        )
        app.state.fields = FieldService(settings, client, DiskCache(settings.cache_dir))
        load_crops()
        log.info("engine started", extra={"version": __version__, "cache_dir": str(settings.cache_dir)})
        yield
        await client.aclose()

    app = FastAPI(
        title="Travertine Engine API",
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )
    limiter = RateLimiter(settings.rate_limit_per_minute)

    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        incoming = request.headers.get("x-request-id", "")
        rid = incoming if 0 < len(incoming) <= 64 and incoming.isprintable() else uuid.uuid4().hex
        token = request_id_var.set(rid)
        started = time.perf_counter()
        try:
            client = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
                request.client.host if request.client else "unknown"
            )
            limited = request.url.path.startswith("/v1/") and request.url.path != "/v1/health"
            allowed, retry_after = limiter.allow(client) if limited else (True, 0.0)
            if not allowed:
                err = RateLimited(
                    "Too many requests; slow down.", details={"retry_after_s": round(retry_after, 1)}
                )
                response: Response = JSONResponse(err.body(), status_code=err.status_code)
                response.headers["Retry-After"] = str(math.ceil(retry_after))
            else:
                response = await call_next(request)
            response.headers["X-Request-ID"] = rid
            log.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000),
                },
            )
            return response
        finally:
            request_id_var.reset(token)

    @app.exception_handler(EngineError)
    async def engine_error(_: Request, exc: EngineError) -> JSONResponse:
        log.warning("engine error", extra={"code": exc.code, "error": exc.message})
        return JSONResponse(exc.body(), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": list(e.get("loc", [])), "msg": e.get("msg", "")} for e in exc.errors()]
        body = {
            "code": "invalid_request",
            "message": "Request does not match the API contract.",
            "details": {"errors": errors},
        }
        return JSONResponse(body, status_code=422)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error")
        return JSONResponse(
            {"code": "internal_error", "message": "Unexpected engine error."}, status_code=500
        )

    @app.get("/v1/health", response_model=Health, tags=["system"])
    async def health() -> Health:
        return Health(status="ok", version=__version__)

    @app.get("/v1/crops", response_model=list[Crop], tags=["crops"], responses=ERROR_RESPONSES)
    async def crops() -> list[Crop]:
        return [
            Crop(
                id=c.id,
                name=c.name,
                family=c.family,
                is_legume=c.is_legume,
                season=c.season,
                growing_days=c.growing_days,
                kc_ini=c.kc.ini,
                kc_mid=c.kc.mid,
                kc_end=c.kc.end,
                root_depth_m=c.root_depth_m,
                source=c.citation(),
            )
            for c in load_crops()
        ]

    @app.post(
        "/v1/field/analyze",
        response_model=FieldAnalysis,
        response_model_exclude_none=True,
        tags=["field"],
        responses=ERROR_RESPONSES,
    )
    async def analyze(body: FieldAnalyzeRequest, request: Request) -> FieldAnalysis:
        service: FieldService = request.app.state.fields
        return await service.analyze(body.lat, body.lon)

    return app


app = create_app()
