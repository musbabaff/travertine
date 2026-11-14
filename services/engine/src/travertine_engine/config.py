from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parents[2]


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True, slots=True)
class Settings:
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:3000"])
    cache_dir: Path = ENGINE_ROOT / "data" / "cache"
    first_year: int = 2001
    last_year: int = datetime.now(UTC).year - 1
    upstream_timeout_s: float = 90.0
    upstream_retries: int = 3
    rate_limit_per_minute: int = 60
    log_level: str = "INFO"

    @classmethod
    def from_env(cls) -> Settings:
        defaults = cls()
        return cls(
            cors_origins=_csv(os.environ.get("ENGINE_CORS_ORIGINS", "")) or defaults.cors_origins,
            cache_dir=Path(os.environ.get("ENGINE_CACHE_DIR", str(defaults.cache_dir))),
            first_year=int(os.environ.get("ENGINE_FIRST_YEAR", defaults.first_year)),
            last_year=int(os.environ.get("ENGINE_LAST_YEAR", defaults.last_year)),
            upstream_timeout_s=float(
                os.environ.get("ENGINE_UPSTREAM_TIMEOUT_S", defaults.upstream_timeout_s)
            ),
            upstream_retries=int(os.environ.get("ENGINE_UPSTREAM_RETRIES", defaults.upstream_retries)),
            rate_limit_per_minute=int(
                os.environ.get("ENGINE_RATE_LIMIT_PER_MINUTE", defaults.rate_limit_per_minute)
            ),
            log_level=os.environ.get("ENGINE_LOG_LEVEL", defaults.log_level).upper(),
        )
