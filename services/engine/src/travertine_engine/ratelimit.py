"""In-process token bucket per client. Cloud Run scales horizontally, so this bounds abuse per instance; it is not a
global quota."""

from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass(slots=True)
class _Bucket:
    tokens: float
    updated: float


class RateLimiter:
    def __init__(self, per_minute: int, *, max_clients: int = 10_000) -> None:
        self.capacity = float(max(per_minute, 1))
        self.rate = self.capacity / 60.0
        self.max_clients = max_clients
        self._buckets: dict[str, _Bucket] = {}

    def allow(self, client: str, now: float | None = None) -> tuple[bool, float]:
        """Returns (allowed, seconds until a token is available)."""
        t = time.monotonic() if now is None else now
        bucket = self._buckets.get(client)
        if bucket is None:
            if len(self._buckets) >= self.max_clients:
                self._buckets.clear()
            bucket = self._buckets[client] = _Bucket(tokens=self.capacity, updated=t)
        bucket.tokens = min(self.capacity, bucket.tokens + (t - bucket.updated) * self.rate)
        bucket.updated = t
        if bucket.tokens >= 1.0:
            bucket.tokens -= 1.0
            return True, 0.0
        return False, (1.0 - bucket.tokens) / self.rate
