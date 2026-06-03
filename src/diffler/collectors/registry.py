"""Collector registry and template dependency analysis."""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from diffler.collectors.base import Collector

logger = logging.getLogger(__name__)

# Regexes to find Jinja2 variable references and function calls
_VAR_REF = re.compile(r"\{\{[\s\-]*([a-zA-Z_][a-zA-Z0-9_]*)\b")
_FUNC_CALL = re.compile(r"\{\{[\s\-]*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(")
# Also scan {% ... %} tags for variable references (e.g. {% for repo in repositories %})
_TAG_VAR_REF = re.compile(r"\{%[\+\s\-]*(?:for\s+\w+\s+in|if|elif|set\s+\w+\s*=)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b")


class CollectorRegistry:
    """Manages registered collectors and determines which ones to run."""

    def __init__(self) -> None:
        self._collectors: dict[str, Collector] = {}

    def register(self, collector: Collector) -> None:
        """Register a collector instance."""
        self._collectors[collector.name] = collector
        logger.debug("Registered collector: %s", collector.name)

    def discover_needed(self, template_source: str) -> list[str]:
        """Analyze template source to find which collectors are needed.

        Scans the template for references to collector ``template_refs``
        and resolves dependencies.

        Args:
            template_source: Raw Jinja2 template text.

        Returns:
            Ordered list of collector names to execute.
        """
        refs = set()
        refs.update(_VAR_REF.findall(template_source))
        refs.update(_FUNC_CALL.findall(template_source))
        refs.update(_TAG_VAR_REF.findall(template_source))

        needed: set[str] = set()
        for name, collector in self._collectors.items():
            if collector.template_refs & refs:
                needed.add(name)

        # Resolve dependencies
        resolved: list[str] = []
        seen: set[str] = set()

        def _resolve(name: str) -> None:
            if name in seen or name not in self._collectors:
                return
            collector = self._collectors[name]
            for dep in collector.dependencies:
                _resolve(dep)
            seen.add(name)
            resolved.append(name)

        for name in list(needed):
            _resolve(name)

        logger.info("Collectors needed: %s", resolved)
        return resolved

    def run(self, names: list[str], ctx: "CollectorContext") -> dict[str, str]:
        """Execute the specified collectors in order.

        Returns:
            Dict mapping collector name to status: "success", "skipped",
            or "failed".
        """
        status: dict[str, str] = {}
        for name in names:
            collector = self._collectors.get(name)
            if not collector:
                continue
            if collector.optional and ctx.rate_limit_remaining < 500:
                logger.warning(
                    "Skipping optional collector %s (rate limit: %s)",
                    name,
                    ctx.rate_limit_remaining,
                )
                status[name] = "skipped"
                continue
            try:
                collector.run(ctx)
                status[name] = "success"
            except Exception:
                logger.exception("Collector %s failed", name)
                status[name] = "failed"
                if not collector.optional:
                    raise
        return status
