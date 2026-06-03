"""Base classes for data collectors."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from diffler.collectors.cache import StatsCache
from diffler.config import DifflerConfig


class CollectorContext:
    """Shared context passed to all collectors during a collection run.

    Holds references to the GitHub client, cache, rate limiter, and
    accumulated results so collectors can build on each other's work.
    """

    def __init__(self, config: DifflerConfig, cache: StatsCache | None = None) -> None:
        self.config = config
        self.results: dict[str, Any] = {}
        self.cache = cache or StatsCache()
        self.rate_limit_remaining: int = 5000
        self.rate_limit_reset: int = 0

    def get(self, key: str, default: Any = None) -> Any:
        """Get a previously collected result by key."""
        return self.results.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Store a collected result."""
        self.results[key] = value


class Collector(ABC):
    """Abstract base class for a data collector.

    Each collector is responsible for fetching one logical data point
    (e.g., contribution calendar, repository list, traffic stats).
    """

    name: str = ""
    """Unique identifier for this collector."""

    template_refs: set[str] = set()
    """Jinja2 global names that, if referenced in a template, indicate
    this collector's data is needed."""

    dependencies: set[str] = set()
    """Names of other collectors that must run before this one."""

    optional: bool = False
    """If True, this collector is skipped when rate limits are low."""

    @abstractmethod
    def collect(self, ctx: CollectorContext) -> Any:
        """Fetch data and return the result.

        The result is automatically stored in ``ctx.results`` under
        ``self.name``.

        Args:
            ctx: Shared collector context.

        Returns:
            The collected data.
        """

    def run(self, ctx: CollectorContext) -> None:
        """Execute collection and store result."""
        value = self.collect(ctx)
        ctx.set(self.name, value)
