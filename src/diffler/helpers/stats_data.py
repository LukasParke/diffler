"""Helpers for consuming LukasParke/stats JSON output (schema v2).

These helpers read the pre-computed stats JSON produced by stats-action,
avoiding API limits and providing richer data than live API calls alone.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_STATS_URL = (
    "https://raw.githubusercontent.com/{username}/stats/main/github-user-stats.json"
)


def stats_json(username: str, url: str | None = None) -> dict[str, Any]:
    """Fetch the pre-computed GitHub stats JSON for a user.

    Args:
        username: GitHub username. Assumes a stats repo at ``{username}/stats``.
        url: Optional override URL for the stats JSON.

    Returns:
        Parsed stats JSON dict. Returns an empty dict on failure.
    """
    fetch_url = url or DEFAULT_STATS_URL.format(username=username)
    try:
        response = httpx.get(fetch_url, timeout=15.0, follow_redirects=True)
        response.raise_for_status()
        return response.json()
    except Exception:
        logger.exception("Failed to fetch stats JSON from %s", fetch_url)
        return {}


def contribution_calendar(stats: dict[str, Any]) -> list[dict]:
    """Extract the contribution calendar weeks from stats JSON.

    Returns:
        List of week dicts, each with ``contributionDays``.
    """
    return (
        stats.get("profileContributions", {})
        .get("contributionCalendar", {})
        .get("weeks", [])
    )


def streak_info(stats: dict[str, Any]) -> dict[str, Any]:
    """Extract streak data from stats JSON.

    Returns:
        Dict with keys: currentStreak, longestStreak, longestStreakStartDate,
        longestStreakEndDate, totalContributions.
    """
    calendar_stats = (
        stats.get("profileContributions", {}).get("stats", {})
    )
    return {
        "current_streak": calendar_stats.get("currentStreak", 0),
        "longest_streak": calendar_stats.get("longestStreak", 0),
        "longest_start": calendar_stats.get("longestStreakStartDate", ""),
        "longest_end": calendar_stats.get("longestStreakEndDate", ""),
        "total_contributions": (
            stats.get("profileContributions", {}).get("totalContributions", 0)
        ),
    }


def top_languages_from_stats(
    stats: dict[str, Any], limit: int = 10
) -> list[dict[str, Any]]:
    """Extract top languages from the stats JSON.

    More accurate than github-readme-stats because it includes private repos
    (if the stats collector was configured to include them).

    Returns:
        List of language dicts with keys: name, color, bytes, percentage.
    """
    languages = stats.get("repoMetrics", {}).get("topLanguages", [])
    return [
        {
            "name": lang.get("languageName", "Unknown"),
            "color": lang.get("color") or "#cccccc",
            "bytes": lang.get("value", 0),
            "percentage": lang.get("percentage", 0),
        }
        for lang in languages[:limit]
    ]


def language_bar_chart(stats: dict[str, Any], width: int = 40) -> str:
    """Generate an ASCII bar chart of language distribution.

    Args:
        stats: Stats JSON dict.
        width: Total width of the bar in characters.

    Returns:
        Markdown string with colored blocks representing language share.
    """
    languages = top_languages_from_stats(stats, limit=6)
    if not languages:
        return ""

    blocks = []
    total_pct = sum(l["percentage"] for l in languages)
    for lang in languages:
        seg_width = max(1, round((lang["percentage"] / total_pct) * width))
        # Use Unicode block characters tinted by language color hint
        blocks.append(f"![](https://img.shields.io/badge/-{lang['percentage']:.1f}%25-{lang['color'].lstrip('#')}?style=flat-square)")

    return " ".join(blocks)


def repo_traffic_summary(stats: dict[str, Any], limit: int = 5) -> list[dict]:
    """Extract repository traffic data from stats JSON.

    Returns:
        List of repo traffic dicts with keys: name, views, unique_views,
        clones, unique_clones.
    """
    traffic = stats.get("repoMetrics", {}).get("traffic", {})
    views = traffic.get("views", [])
    clones = traffic.get("clones", [])

    # Merge views and clones by repo name
    by_repo: dict[str, dict] = {}
    for v in views:
        name = v.get("repo", "unknown")
        by_repo.setdefault(name, {"name": name})
        by_repo[name]["views"] = v.get("count", 0)
        by_repo[name]["unique_views"] = v.get("uniques", 0)
    for c in clones:
        name = c.get("repo", "unknown")
        by_repo.setdefault(name, {"name": name})
        by_repo[name]["clones"] = c.get("count", 0)
        by_repo[name]["unique_clones"] = c.get("uniques", 0)

    # Sort by total views
    result = sorted(
        by_repo.values(),
        key=lambda r: r.get("views", 0),
        reverse=True,
    )
    return result[:limit]


def activity_timeline(stats: dict[str, Any]) -> list[dict]:
    """Extract the monthly/yearly activity timeline from stats JSON.

    Returns:
        List of period dicts with keys: period, commits, issues, prs, reviews.
    """
    timeline = stats.get("presentation", {}).get("timeline", [])
    return [
        {
            "period": t.get("period", ""),
            "commits": t.get("commits", 0),
            "issues": t.get("issues", 0),
            "prs": t.get("pullRequests", 0),
            "reviews": t.get("reviews", 0),
        }
        for t in timeline
    ]


def highlights(stats: dict[str, Any]) -> list[dict]:
    """Extract highlight events from stats JSON.

    Returns:
        List of highlight dicts with keys: type, description, date.
    """
    return stats.get("presentation", {}).get("highlights", [])


def readme_summary(stats: dict[str, Any]) -> dict[str, Any]:
    """Extract the compact README summary from stats JSON.

    Returns:
        Dict with compact widget-ready values.
    """
    return stats.get("presentation", {}).get("readmeSummary", {})
