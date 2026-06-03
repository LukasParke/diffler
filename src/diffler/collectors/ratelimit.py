"""GitHub API rate limit monitoring."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class RateLimitMonitor:
    """Tracks GitHub GraphQL and REST rate limit budgets."""

    def __init__(self) -> None:
        self.graphql_remaining: int = 5000
        self.graphql_reset: int = 0
        self.rest_remaining: int = 5000
        self.rest_reset: int = 0

    def update_from_response(self, response: httpx.Response) -> None:
        """Update budgets from response headers."""
        if "x-ratelimit-remaining" in response.headers:
            self.rest_remaining = int(response.headers["x-ratelimit-remaining"])
            self.rest_reset = int(response.headers.get("x-ratelimit-reset", 0))
            logger.debug("REST rate limit: %s remaining", self.rest_remaining)

    def update_graphql(self, data: dict[str, Any]) -> None:
        """Update GraphQL budget from rateLimit field."""
        rate_limit = data.get("data", {}).get("rateLimit")
        if rate_limit:
            self.graphql_remaining = rate_limit.get("remaining", 5000)
            self.graphql_reset = rate_limit.get("resetAt", "")
            logger.debug("GraphQL rate limit: %s remaining", self.graphql_remaining)

    def can_afford(self, cost: int = 1, is_graphql: bool = True) -> bool:
        """Check if we have enough budget for a request."""
        remaining = self.graphql_remaining if is_graphql else self.rest_remaining
        return remaining >= cost

    def __repr__(self) -> str:
        return (
            f"RateLimit(graphql={self.graphql_remaining}, "
            f"rest={self.rest_remaining})"
        )
