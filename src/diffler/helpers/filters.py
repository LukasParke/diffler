"""Repository filtering and sorting helpers."""

from __future__ import annotations

from typing import Callable


def _normalize(repo: dict) -> dict:
    """Ensure all expected keys exist with sensible defaults."""
    return {
        "name": repo.get("name") or "",
        "full_name": repo.get("full_name") or "",
        "description": repo.get("description") or "",
        "url": repo.get("url") or "",
        "stars": repo.get("stars") or 0,
        "forks": repo.get("forks") or 0,
        "language": repo.get("language"),
        "language_color": repo.get("language_color"),
        "is_fork": repo.get("is_fork", False),
        "is_archived": repo.get("is_archived", False),
    }


def filter_repos(
    repos: list[dict],
    *,
    language: str | None = None,
    min_stars: int | None = None,
    max_stars: int | None = None,
    exclude_forks: bool = False,
    exclude_archived: bool = False,
    search: str | None = None,
    sort_by: str = "stars",
    sort_desc: bool = True,
    limit: int | None = None,
) -> list[dict]:
    """Filter and sort a list of repository dicts.

    Args:
        repos: List of repository dicts from the GitHub API.
        language: Filter by primary language (case-insensitive).
        min_stars: Minimum star count (inclusive).
        max_stars: Maximum star count (inclusive).
        exclude_forks: Skip forked repositories.
        exclude_archived: Skip archived repositories.
        search: Substring to match against name or description.
        sort_by: Field to sort by — "stars", "forks", "name", "language".
        sort_desc: Sort descending (default) or ascending.
        limit: Maximum number of results to return.

    Returns:
        Filtered, sorted, and optionally limited list of repository dicts.
    """
    normalized = [_normalize(r) for r in repos]
    result = list(normalized)

    if exclude_forks:
        result = [r for r in result if not r["is_fork"]]

    if exclude_archived:
        result = [r for r in result if not r["is_archived"]]

    if language:
        lang_lower = language.lower()
        result = [
            r for r in result
            if r["language"] and r["language"].lower() == lang_lower
        ]

    if min_stars is not None:
        result = [r for r in result if r["stars"] >= min_stars]

    if max_stars is not None:
        result = [r for r in result if r["stars"] <= max_stars]

    if search:
        term = search.lower()
        result = [
            r for r in result
            if term in r["name"].lower()
            or term in (r["description"] or "").lower()
            or term in (r["full_name"] or "").lower()
        ]

    # Sorting
    sort_key: Callable
    if sort_by == "stars":
        sort_key = lambda r: r["stars"]
    elif sort_by == "forks":
        sort_key = lambda r: r["forks"]
    elif sort_by == "name":
        sort_key = lambda r: r["name"].lower()
    elif sort_by == "language":
        sort_key = lambda r: (r["language"] or "").lower()
    else:
        sort_key = lambda r: r["stars"]

    result = sorted(result, key=sort_key, reverse=sort_desc)

    if limit is not None:
        result = result[:limit]

    return result


def repos_by_language(repos: list[dict]) -> dict[str, list[dict]]:
    """Group repositories by their primary language.

    Args:
        repos: List of repository dicts.

    Returns:
        Dict mapping language name to list of repos.
    """
    groups: dict[str, list[dict]] = {}
    for repo in repos:
        lang = repo.get("language") or "Unknown"
        groups.setdefault(lang, []).append(_normalize(repo))
    # Sort each group by stars descending
    for lang in groups:
        groups[lang] = sorted(groups[lang], key=lambda r: r["stars"], reverse=True)
    return dict(sorted(groups.items()))


def language_breakdown(repos: list[dict]) -> list[dict]:
    """Return a summary of languages used across repositories.

    Args:
        repos: List of repository dicts.

    Returns:
        List of dicts with keys: language, count, total_stars, color.
    """
    stats: dict[str, dict] = {}
    for repo in repos:
        lang = repo.get("language") or "Unknown"
        color = repo.get("language_color")
        if lang not in stats:
            stats[lang] = {"language": lang, "count": 0, "total_stars": 0, "color": color}
        stats[lang]["count"] += 1
        stats[lang]["total_stars"] += repo.get("stars", 0)

    result = sorted(stats.values(), key=lambda s: s["total_stars"], reverse=True)
    return result
