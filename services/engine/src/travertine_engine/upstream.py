"""HTTP access to upstream data services: timeouts, retries with exponential backoff and jitter."""

from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any

import httpx

from travertine_engine.errors import UpstreamUnavailable

log = logging.getLogger(__name__)

RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}
USER_AGENT = "travertine-engine (+https://github.com/musbabaff/travertine)"


class Upstream:
    def __init__(self, *, timeout_s: float, retries: int, client: httpx.AsyncClient | None = None) -> None:
        self.retries = retries
        self.client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_s, connect=15.0),
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self.client.aclose()

    async def get_json(self, source: str, url: str, params: Any = None) -> Any:
        last_error = ""
        for attempt in range(self.retries + 1):
            started = time.perf_counter()
            try:
                response = await self.client.get(url, params=params)
            except httpx.TransportError as exc:
                last_error = f"{type(exc).__name__}: {exc}"
            else:
                elapsed_ms = round((time.perf_counter() - started) * 1000)
                log.info(
                    "upstream response",
                    extra={
                        "source": source,
                        "status": response.status_code,
                        "elapsed_ms": elapsed_ms,
                        "attempt": attempt + 1,
                    },
                )
                if response.status_code == 200:
                    return response.json()
                last_error = f"HTTP {response.status_code}: {response.text[:300]}"
                if response.status_code not in RETRYABLE_STATUS:
                    break
            if attempt < self.retries:
                delay = min(2.0**attempt, 20.0) * (0.5 + random.random())
                log.warning("upstream retry", extra={"source": source, "error": last_error, "delay_s": delay})
                await asyncio.sleep(delay)
        raise UpstreamUnavailable(
            f"{source} did not return data.", details={"source": source, "error": last_error}
        )
