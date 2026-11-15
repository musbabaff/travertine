import os
import re

__version__ = "0.1.0"


def build_version() -> str:
    """Semantic version with the deployed commit as build metadata (`0.1.0+69b6d7b`), so a deploy can be checked on
    /v1/health. The commit comes from ENGINE_COMMIT or, on Render, RENDER_GIT_COMMIT; a value that is not a
    commit hash is ignored, and without a usable one the plain version is returned."""
    for name in ("ENGINE_COMMIT", "RENDER_GIT_COMMIT"):
        commit = os.environ.get(name, "").strip().lower()
        if re.fullmatch(r"[0-9a-f]{7,40}", commit):
            return f"{__version__}+{commit[:7]}"
    return __version__
