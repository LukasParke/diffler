"""GitHub Actions entrypoint for Diffler."""

from __future__ import annotations

import logging
import os
import sys

from diffler.config import DifflerConfig
from diffler.core.engine import Engine
from diffler.core.renderer import Renderer

logger = logging.getLogger(__name__)


def main() -> int:
    """Run diffler from within a GitHub Action."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config_path = os.environ.get("INPUT_CONFIG-FILE", ".github/diffler.yml")
    dry_run = os.environ.get("INPUT_DRY-RUN", "false").lower() == "true"
    message = os.environ.get("INPUT_COMMIT-MESSAGE", "🤖 Auto-update profile README")

    config = DifflerConfig.from_file(config_path)
    renderer = Renderer(config)
    engine = Engine(config, renderer)

    try:
        engine.update(dry_run=dry_run, message=message)
    except Exception:
        logger.exception("Diffler update failed")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
