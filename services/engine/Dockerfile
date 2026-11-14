# Build from services/engine:  docker build -t travertine-engine .
FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_CACHE_DIR=/tmp/uv-build-cache \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY data/crops.yaml ./data/crops.yaml
COPY data/snapshot ./data/snapshot
COPY scripts ./scripts
RUN uv sync --frozen --no-dev && rm -rf /tmp/uv-build-cache

# From here on nothing calls uv: the virtualenv is on PATH and the server runs straight from it.
ENV PATH=/app/.venv/bin:$PATH \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache \
    PYTHONDONTWRITEBYTECODE=1 \
    ENGINE_CACHE_DIR=/app/data/cache \
    ENGINE_SNAPSHOT_DIR=/app/data/snapshot \
    ENGINE_LAST_YEAR=2025

# The demo field comes from the committed snapshot, with no network call. A live refresh may add to it, but it
# is capped at 30 seconds and can neither fail nor hold up the build.
RUN python scripts/load_snapshot.py
RUN timeout 30 python scripts/prewarm.py --refresh || true

RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin engine && chown -R engine /app/data
USER engine

EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn travertine_engine.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --proxy-headers --forwarded-allow-ips='*'"]
