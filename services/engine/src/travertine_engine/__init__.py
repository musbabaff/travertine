import os
import re

__version__ = "0.1.0"


def build_version() -> str:
    """Semantic version with the deployed commit as build metadata (`0.1.0+69b6d7b`), so a deploy can be checked on
    /v1/health. The commit comes from ENGINE_COMMIT or, on Render, RENDER_GIT_COMMIT; without either the plain
    version is returned."""
    commit = (os.environ.get("ENGINE_COMMIT") or os.environ.get("RENDER_GIT_COMMIT") or "").strip().lower()
    if re.fullmatch(r"[0-9a-f]{7,40}", commit):
        return f"{__version__}+{commit[:7]}"
    return __version__
