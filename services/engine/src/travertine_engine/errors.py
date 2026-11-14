"""Typed errors that serialise to the contract's `Error` schema."""

from __future__ import annotations

from typing import Any


class EngineError(Exception):
    status_code = 500
    code = "internal_error"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def body(self) -> dict[str, Any]:
        out: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details:
            out["details"] = self.details
        return out


class UpstreamUnavailable(EngineError):
    status_code = 502
    code = "upstream_unavailable"


class OutOfCoverage(EngineError):
    status_code = 422
    code = "out_of_coverage"


class InvalidRequest(EngineError):
    status_code = 422
    code = "invalid_request"


class NotFound(EngineError):
    status_code = 404
    code = "not_found"


class RateLimited(EngineError):
    status_code = 429
    code = "rate_limited"
