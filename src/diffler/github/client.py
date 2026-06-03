"""Unified GitHub API client with retries and rate limit awareness."""

from __future__ import annotations

import logging
import time

import httpx

from diffler.config import GitHubConfig

logger = logging.getLogger(__name__)


def _auth_headers(token: str) -> dict[str, str]:
    """Build headers dict, only including Authorization if token is present."""
    headers: dict[str, str] = {}
    if token and not token.startswith("${"):
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _retry_request(
    method: callable,
    max_retries: int = 3,
    backoff: float = 2.0,
) -> httpx.Response:
    """Execute an HTTP request with exponential backoff on 502/503/504."""
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            response = method()
            if response.status_code < 500:
                return response
            # Server error — retry if we have attempts left
            if attempt < max_retries:
                sleep_time = backoff * (2 ** attempt)
                logger.warning(
                    "HTTP %s (attempt %d/%d), retrying in %.1fs...",
                    response.status_code,
                    attempt + 1,
                    max_retries + 1,
                    sleep_time,
                )
                time.sleep(sleep_time)
            else:
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            if attempt < max_retries and exc.response.status_code >= 500:
                sleep_time = backoff * (2 ** attempt)
                logger.warning(
                    "HTTP %s (attempt %d/%d), retrying in %.1fs...",
                    exc.response.status_code,
                    attempt + 1,
                    max_retries + 1,
                    sleep_time,
                )
                time.sleep(sleep_time)
            else:
                raise
        except httpx.RequestError as exc:
            last_exc = exc
            if attempt < max_retries:
                sleep_time = backoff * (2 ** attempt)
                logger.warning(
                    "Request error (attempt %d/%d), retrying in %.1fs...",
                    attempt + 1,
                    max_retries + 1,
                    sleep_time,
                )
                time.sleep(sleep_time)
            else:
                raise
    raise last_exc or RuntimeError("Retry exhausted")


class GitHubClient:
    """Client for GitHub REST and GraphQL APIs."""

    def __init__(self, config: GitHubConfig) -> None:
        self.config = config

        rest_headers = _auth_headers(config.token)
        rest_headers.update(
            {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        )
        self._rest = httpx.Client(
            base_url=config.api_url,
            headers=rest_headers,
            timeout=30.0,
        )

        graphql_headers = _auth_headers(config.token)
        # GitHub GraphQL endpoint doesn't tolerate a trailing slash, so we use
        # the API root as base_url and POST to /graphql explicitly.
        self._graphql = httpx.Client(
            base_url=config.api_url,
            headers=graphql_headers,
            timeout=30.0,
        )

    def rest_get(self, path: str, **kwargs) -> dict:
        """Perform a GET request against the GitHub REST API."""
        response = _retry_request(lambda: self._rest.get(path, **kwargs))
        response.raise_for_status()
        return response.json()

    def graphql_query(self, query: str, variables: dict | None = None) -> dict:
        """Execute a GraphQL query with retries on server errors."""
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        response = _retry_request(lambda: self._graphql.post("/graphql", json=payload))
        response.raise_for_status()
        data = response.json()
        if "errors" in data:
            raise RuntimeError(f"GraphQL errors: {data['errors']}")
        return data["data"]

    def close(self) -> None:
        """Close underlying HTTP clients."""
        self._rest.close()
        self._graphql.close()
