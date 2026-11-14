# Build from services/engine:  docker build -t travertine-engine .
FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    ENGINE_CACHE_DIR=/app/data/cache

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY data/crops.yaml ./data/crops.yaml
COPY scripts ./scripts
RUN uv sync --frozen --no-dev

# Bake the demo field into the image cache so the demo survives an upstream outage. Network problems at build time
# must not break the build; the engine then fetches on first request instead.
RUN uv run --no-sync python scripts/prewarm.py || echo "prewarm incomplete; continuing without a full demo cache"

RUN useradd --uid 10001 --no-create-home engine && chown -R engine /app/data
USER engine

EXPOSE 8000
CMD ["sh", "-c", "exec uv run --no-sync uvicorn travertine_engine.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
