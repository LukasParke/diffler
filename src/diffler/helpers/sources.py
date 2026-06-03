"""Data source helpers that fetch live information from APIs."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def _github_rest(path: str, token: str = "") -> list[dict] | dict:
    """Make an unauthenticated or authenticated GitHub REST API call."""
    headers: dict[str, str] = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token and not token.startswith("${"):
        headers["Authorization"] = f"Bearer {token}"
    response = httpx.get(
        f"https://api.github.com{path}",
        headers=headers,
        timeout=15.0,
    )
    response.raise_for_status()
    return response.json()


def github_events(username: str, token: str = "", limit: int = 10) -> list[dict]:
    """Fetch recent public GitHub events for a user.

    Args:
        username: GitHub username.
        token: Optional token for higher rate limits.
        limit: Maximum events to return.

    Returns:
        List of event dicts with keys: type, repo, payload, created_at.
    """
    try:
        data = _github_rest(f"/users/{username}/events/public?per_page={limit}", token)
        if not isinstance(data, list):
            return []
        return [
            {
                "type": e.get("type", "Unknown"),
                "repo": e.get("repo", {}).get("name", "unknown"),
                "repo_url": f"https://github.com/{e.get('repo', {}).get('name', '')}",
                "payload": e.get("payload", {}),
                "created_at": e.get("created_at", ""),
            }
            for e in data[:limit]
        ]
    except Exception:
        logger.exception("Failed to fetch GitHub events for %s", username)
        return []


def recent_stars(username: str, token: str = "", limit: int = 10) -> list[dict]:
    """Fetch recently starred repositories for a user.

    Args:
        username: GitHub username.
        token: Optional token for higher rate limits.
        limit: Maximum stars to return.

    Returns:
        List of starred repo dicts with keys: name, full_name, url,
        description, stars, language, starred_at.
    """
    try:
        data = _github_rest(f"/users/{username}/starred?per_page={limit}&sort=created", token)
        if not isinstance(data, list):
            return []
        return [
            {
                "name": r.get("name") or "unknown",
                "full_name": r.get("full_name") or "",
                "url": r.get("html_url") or "",
                "description": r.get("description") or "",
                "stars": r.get("stargazers_count", 0),
                "language": r.get("language"),
                "starred_at": r.get("starred_at", ""),
            }
            for r in data[:limit]
        ]
    except Exception:
        logger.exception("Failed to fetch starred repos for %s", username)
        return []


def gists(username: str, token: str = "", limit: int = 5) -> list[dict]:
    """Fetch public gists for a user.

    Args:
        username: GitHub username.
        token: Optional token for higher rate limits.
        limit: Maximum gists to return.

    Returns:
        List of gist dicts with keys: id, description, url, created_at,
        files (list of filenames).
    """
    try:
        data = _github_rest(f"/users/{username}/gists?per_page={limit}", token)
        if not isinstance(data, list):
            return []
        return [
            {
                "id": g.get("id", ""),
                "description": g.get("description") or "",
                "url": g.get("html_url") or "",
                "created_at": g.get("created_at", ""),
                "files": list(g.get("files", {}).keys()),
            }
            for g in data[:limit]
        ]
    except Exception:
        logger.exception("Failed to fetch gists for %s", username)
        return []


def releases(username: str, token: str = "", limit: int = 5) -> list[dict]:
    """Fetch recent releases from a user's repositories.

    Args:
        username: GitHub username.
        token: Optional token for higher rate limits.
        limit: Maximum releases to return.

    Returns:
        List of release dicts with keys: name, tag, url, published_at,
        repo, body.
    """
    try:
        repos = _github_rest(f"/users/{username}/repos?per_page=30&sort=pushed", token)
        if not isinstance(repos, list):
            return []
        results = []
        for repo in repos:
            if len(results) >= limit:
                break
            repo_name = repo.get("name", "")
            releases_data = _github_rest(
                f"/repos/{username}/{repo_name}/releases?per_page=1",
                token,
            )
            if isinstance(releases_data, list) and releases_data:
                r = releases_data[0]
                results.append(
                    {
                        "name": r.get("name") or r.get("tag_name", "unknown"),
                        "tag": r.get("tag_name", ""),
                        "url": r.get("html_url") or "",
                        "published_at": r.get("published_at", ""),
                        "repo": repo_name,
                        "repo_url": repo.get("html_url", ""),
                        "body": (r.get("body") or "")[:200],
                    }
                )
        return results[:limit]
    except Exception:
        logger.exception("Failed to fetch releases for %s", username)
        return []


def sponsors(username: str, token: str = "", limit: int = 10) -> list[dict]:
    """Fetch GitHub sponsors for a user.

    Requires a token with `read:org` or appropriate scopes.

    Args:
        username: GitHub username.
        token: Optional token for authentication.
        limit: Maximum sponsors to return.

    Returns:
        List of sponsor dicts with keys: login, name, url, avatar_url.
    """
    if not token or token.startswith("${"):
        logger.warning("Sponsors require an authenticated token")
        return []
    try:
        data = _github_rest(
            f"/users/{username}/sponsorships?per_page={limit}",
            token,
        )
        if not isinstance(data, list):
            return []
        return [
            {
                "login": s.get("sponsor", {}).get("login", "unknown"),
                "name": s.get("sponsor", {}).get("name") or "",
                "url": s.get("sponsor", {}).get("html_url") or "",
                "avatar_url": s.get("sponsor", {}).get("avatar_url") or "",
            }
            for s in data[:limit]
        ]
    except Exception:
        logger.exception("Failed to fetch sponsors for %s", username)
        return []


def fetch_json(url: str, headers: dict[str, str] | None = None) -> Any:
    """Generic HTTP GET that returns parsed JSON.

    Args:
        url: Full URL to fetch.
        headers: Optional request headers.

    Returns:
        Parsed JSON (dict, list, etc.).
    """
    try:
        response = httpx.get(url, headers=headers or {}, timeout=15.0)
        response.raise_for_status()
        return response.json()
    except Exception:
        logger.exception("Failed to fetch JSON from %s", url)
        return {}
