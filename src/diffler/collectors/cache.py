"""Caching layer for collected data."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_CACHE_DIR = Path(".github-profile-stats")
DEFAULT_CACHE_FILE = DEFAULT_CACHE_DIR / "cache.json"
DEFAULT_VOLATILE_FILE = DEFAULT_CACHE_DIR / "volatile-cache.json"


class StatsCache:
    """Two-tier cache: stable (disk) + volatile (memory-only).

    Matches the stats-action caching model:
    - Stable cache stores historical contribution years, public-safe repo
      metadata, and REST backfill state. Can be committed to git.
    - Volatile cache stores REST ETag/last-modified metadata. Not committed.
    """

    def __init__(
        self,
        stable_path: Path | None = None,
        volatile_path: Path | None = None,
    ) -> None:
        self.stable_path = stable_path or DEFAULT_CACHE_FILE
        self.volatile_path = volatile_path or DEFAULT_VOLATILE_FILE
        self.stable: dict[str, Any] = {}
        self.volatile: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        if self.stable_path.exists():
            try:
                self.stable = json.loads(self.stable_path.read_text())
                logger.info("Loaded stable cache with %d keys", len(self.stable))
            except Exception:
                logger.warning("Failed to load stable cache")
        if self.volatile_path.exists():
            try:
                self.volatile = json.loads(self.volatile_path.read_text())
            except Exception:
                logger.warning("Failed to load volatile cache")

    def save(self) -> None:
        """Write stable cache to disk. Volatile is NOT saved."""
        self.stable_path.parent.mkdir(parents=True, exist_ok=True)
        self.stable_path.write_text(
            json.dumps(self.stable, indent=2, default=str),
            encoding="utf-8",
        )
        logger.info("Saved stable cache (%d keys)", len(self.stable))

    def get(self, key: str, default: Any = None) -> Any:
        """Check volatile first, then stable."""
        return self.volatile.get(key, self.stable.get(key, default))

    def set_stable(self, key: str, value: Any) -> None:
        self.stable[key] = value

    def set_volatile(self, key: str, value: Any) -> None:
        self.volatile[key] = value
