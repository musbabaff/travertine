"""FastAPI application implementing `packages/contract/openapi.yaml` (v1)."""

from __future__ import annotations

import asyncio
import logging
import math
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from travertine_engine import __version__, build_version
from travertine_engine.cache import DiskCache, load_snapshot
from travertine_engine.config import Settings
from travertine_engine.errors import EngineError, RateLimited
from travertine_engine.explore import ExploreService
from travertine_engine.field import FieldService
from travertine_engine.field_ndvi import FieldNdviService
from travertine_engine.logs import configure_logging, request_id_var
from travertine_engine.models import (
    Crop,
    ErrorBody,
    FieldAnalysis,
    FieldAnalyzeRequest,
    FieldClimate,
    FieldNdvi,
    FieldSoil,
    FieldVegetation,
    Health,
    RotationExploreRequest,
    RotationExploreResponse,
    Showcase,
    Validation,
)
from travertine_engine.ratelimit import RateLimiter
from travertine_engine.science.crops import load_crops
from travertine_engine.showcase import load_showcase
from travertine_engine.text import Language
from travertine_engine.upstream import Upstream
from travertine_engine.validation import ValidationService

log = logging.getLogger("travertine_engine")

ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    "422": {"model": ErrorBody},
    "default": {"model": ErrorBody},
}


async def warm_fields(explore: ExploreService, fields: list[tuple[float, float]]) -> None:
    """Fill the rotation caches for configured fields in the background, so the first explore of the demo field does
    not pay for the back-cast. Failures are logged and ignored; the service answers either way."""
    for lat, lon in fields:
        started = time.perf_counter()
        try:
            await explore.warm(lat, lon)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("explore warm-up failed", extra={"lat": lat, "lon": lon})
            continue
        log.info(
            "explore caches warm",
            extra={"lat": lat, "lon": lon, "elapsed_ms": round((time.perf_counter() - started) * 1000)},
        )


def attach_services(app: FastAPI, settings: Settings, client: Upstream) -> int:
    """Build the services on app.state; returns how many snapshot entries were copied into the cache."""
    cache = DiskCache(settings.cache_dir)
    loaded = load_snapshot(cache, settings.snapshot_dir) if settings.snapshot_dir else 0
    app.state.fields = FieldService(settings, client, cache)
    app.state.explore = ExploreService(app.state.fields)
    app.state.validation = ValidationService(app.state.explore)
    app.state.field_ndvi = FieldNdviService(app.state.fields)
    load_crops()
    return loaded


def create_app(settings: Settings | None = None, upstream: Upstream | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        client = upstream or Upstream(
            timeout_s=settings.upstream_timeout_s, retries=settings.upstream_retries
        )
        loaded = attach_services(app, settings, client)
        log.info(
            "engine started",
            extra={
                "version": build_version(),
                "cache_dir": str(settings.cache_dir),
                "snapshot_entries_loaded": loaded,
            },
        )
        warming = asyncio.create_task(warm_fields(app.state.explore, settings.warm_fields))
        yield
        warming.cancel()
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
        allow_origin_regex=settings.cors_origin_regex,
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
        return Health(status="ok", version=build_version())

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

    add_science_routes(app)

    return app


def add_science_routes(app: FastAPI) -> None:
    """Field, rotation and validation endpoints; each delegates to a service built in the lifespan."""

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

    @app.get("/v1/field/climate", response_model=FieldClimate, tags=["field"], responses=ERROR_RESPONSES)
    async def field_climate(
        request: Request,
        lat: Annotated[float, Query(ge=-90, le=90)],
        lon: Annotated[float, Query(ge=-180, le=180)],
    ) -> FieldClimate:
        service: FieldService = request.app.state.fields
        return await service.climate(lat, lon)

    @app.get("/v1/field/soil", response_model=FieldSoil, tags=["field"], responses=ERROR_RESPONSES)
    async def field_soil(
        request: Request,
        lat: Annotated[float, Query(ge=-90, le=90)],
        lon: Annotated[float, Query(ge=-180, le=180)],
    ) -> FieldSoil:
        service: FieldService = request.app.state.fields
        return await service.soil(lat, lon)

    @app.get(
        "/v1/field/vegetation", response_model=FieldVegetation, tags=["field"], responses=ERROR_RESPONSES
    )
    async def field_vegetation(
        request: Request,
        lat: Annotated[float, Query(ge=-90, le=90)],
        lon: Annotated[float, Query(ge=-180, le=180)],
    ) -> FieldVegetation:
        service: FieldService = request.app.state.fields
        return await service.vegetation(lat, lon)

    @app.get(
        "/v1/showcase",
        response_model=Showcase,
        response_model_exclude_none=True,
        tags=["validation"],
        responses=ERROR_RESPONSES,
    )
    async def showcase() -> Showcase:
        return load_showcase()

    @app.get(
        "/v1/field/ndvi",
        response_model=FieldNdvi,
        response_model_exclude_none=True,
        tags=["field"],
        responses=ERROR_RESPONSES,
    )
    async def field_ndvi(
        request: Request,
        lat: Annotated[float, Query(ge=-90, le=90)],
        lon: Annotated[float, Query(ge=-180, le=180)],
    ) -> FieldNdvi:
        service: FieldNdviService = request.app.state.field_ndvi
        return await service.history(lat, lon)

    @app.post(
        "/v1/rotations/explore",
        response_model=RotationExploreResponse,
        response_model_exclude_none=True,
        tags=["rotations"],
        responses={"404": {"model": ErrorBody}, **ERROR_RESPONSES},
    )
    async def explore(body: RotationExploreRequest, request: Request) -> RotationExploreResponse:
        service: ExploreService = request.app.state.explore
        return await service.explore(body)

    @app.get("/v1/validation", response_model=Validation, tags=["validation"], responses=ERROR_RESPONSES)
    async def validation(
        request: Request,
        lat: Annotated[float, Query(ge=-90, le=90)],
        lon: Annotated[float, Query(ge=-180, le=180)],
        language: Language = "en",
    ) -> Validation:
        service: ValidationService = request.app.state.validation
        return await service.validate(lat, lon, language)


app = create_app()
