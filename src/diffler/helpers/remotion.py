"""Remotion config generation helpers.

Generates input.json and scene configs for github-stats-remotion
from collected stats data.
"""

from __future__ import annotations

import json
from typing import Any


def remotion_input(stats: dict[str, Any]) -> dict[str, Any]:
    """Generate the input.json for github-stats-remotion.

    Args:
        stats: Schema v2 stats dict (from stats_json or build_v2_output).

    Returns:
        Dict matching remotion's expected input shape.
    """
    profile = stats.get("profile", {})
    contributions = stats.get("profileContributions", {})
    calendar = contributions.get("contributionCalendar", {})
    stats_block = contributions.get("stats", {})
    repo_metrics = stats.get("repoMetrics", {})

    return {
        "username": profile.get("login") or stats.get("username"),
        "name": profile.get("name") or stats.get("name"),
        "avatarUrl": profile.get("avatarUrl") or stats.get("avatarUrl"),
        "totalContributions": contributions.get("totalContributions", 0),
        "currentStreak": stats_block.get("currentStreak", 0),
        "longestStreak": stats_block.get("longestStreak", 0),
        "publicRepos": repo_metrics.get("publicRepoCount", 0),
        "totalStars": repo_metrics.get("starCount", 0),
        "totalForks": repo_metrics.get("forkCount", 0),
        "topLanguages": [
            {
                "name": lang.get("languageName"),
                "percentage": lang.get("percentage", 0),
                "color": lang.get("color"),
            }
            for lang in repo_metrics.get("topLanguages", [])[:10]
        ],
        "calendar": calendar.get("weeks", []),
    }


def write_remotion_input(
    stats: dict[str, Any],
    path: str = "input.json",
) -> None:
    """Write remotion input.json to disk.

    Args:
        stats: Schema v2 stats dict.
        path: Output file path.
    """
    data = remotion_input(stats)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def remotion_scene_config(
    scene: str,
    stats: dict[str, Any],
) -> dict[str, Any]:
    """Generate config for a specific remotion scene.

    Args:
        scene: Scene name — "readme", "stats", "languages",
            "activity-overview", "commit-streak".
        stats: Schema v2 stats dict.

    Returns:
        Scene-specific configuration dict.
    """
    base = remotion_input(stats)

    configs: dict[str, dict] = {
        "readme": {
            **base,
            "scene": "readme",
            "duration": 300,
        },
        "stats": {
            **base,
            "scene": "stats",
            "duration": 300,
            "showBreakdown": True,
        },
        "languages": {
            **base,
            "scene": "languages",
            "duration": 240,
            "languages": base.get("topLanguages", [])[:6],
        },
        "activity-overview": {
            **base,
            "scene": "activity-overview",
            "duration": 300,
            "calendar": base.get("calendar", []),
        },
        "commit-streak": {
            **base,
            "scene": "commit-streak",
            "duration": 240,
            "currentStreak": base.get("currentStreak", 0),
            "longestStreak": base.get("longestStreak", 0),
        },
    }

    return configs.get(scene, {"scene": scene, **base})


def remotion_scene_manifest(
    stats: dict[str, Any],
    scene_template: str | None = None,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate a remotion scene manifest from stats data.

    If a Jinja2 scene template is provided, it is rendered against the
    stats context and parsed as JSON. Otherwise a default manifest is
    built with conditional scene inclusion based on data availability.

    Args:
        stats: Schema v2 stats dict.
        scene_template: Optional raw Jinja2 template string for the manifest.

    Returns:
        Dict with ``scenes`` and ``theme`` keys.
    """
    if scene_template:
        from jinja2 import Environment
        env = Environment()
        rendered = env.from_string(scene_template).render(
            stats=stats,
            config=config or {},
        )
        return json.loads(rendered)

    repo_metrics = stats.get("repoMetrics", {})
    contributions = stats.get("profileContributions", {})
    activity = stats.get("activity", {})
    computed = stats.get("computedStats", {})
    streak = contributions.get("stats", {}).get("currentStreak", 0)
    lang_count = len(repo_metrics.get("topLanguages", []))

    scenes = [
        {"id": "readme", "durationInFrames": 192, "enabled": True},
        {"id": "stats", "durationInFrames": 192, "enabled": True},
    ]

    if lang_count >= 2:
        scenes.append({"id": "languages", "durationInFrames": 240, "enabled": True})

    if lang_count >= 2:
        scenes.append({"id": "top-languages", "durationInFrames": 240, "enabled": True})

    if streak >= 3:
        scenes.append({"id": "commit-streak", "durationInFrames": 240, "enabled": True})

    if activity.get("repositoriesContributedTo", 0) > 0:
        scenes.append({"id": "repo-impact", "durationInFrames": 192, "enabled": True})

    scenes.append({"id": "activity-overview", "durationInFrames": 192, "enabled": True})

    if computed.get("yearOverYearGrowth", 0) > 0:
        scenes.append({"id": "code-metrics", "durationInFrames": 192, "enabled": True})

    return {
        "scenes": scenes,
        "theme": {
            "primaryColor": "#3b82f6",
            "backgroundGradient": ["#0f172a", "#1e293b"],
        },
    }


def remotion_cards_template(stats: dict[str, Any]) -> dict[str, Any]:
    """Generate metric cards and highlights for remotion.

    Returns a dict with ``cards`` and ``highlights`` arrays matching
    the remotion schema.
    """
    profile = stats.get("profile", {})
    contributions = stats.get("profileContributions", {})
    repo_metrics = stats.get("repoMetrics", {})
    activity = stats.get("activity", {})
    computed = stats.get("computedStats", {})

    cards = [
        {"id": "contributions", "label": "Contributions", "value": contributions.get("totalContributions", 0)},
        {"id": "commits", "label": "Commits", "value": contributions.get("totalCommitContributions", 0)},
        {"id": "pull-requests", "label": "Pull Requests", "value": activity.get("totalPullRequests", contributions.get("totalPullRequestContributions", 0))},
        {"id": "issues", "label": "Issues", "value": activity.get("closedIssues", 0)},
        {"id": "repositories", "label": "Repositories", "value": repo_metrics.get("publicRepoCount", 0)},
        {"id": "stars", "label": "Stars", "value": repo_metrics.get("starCount", 0)},
        {"id": "followers", "label": "Followers", "value": profile.get("followers", 0)},
    ]

    highlights: list[dict[str, Any]] = []
    streak = contributions.get("stats", {}).get("currentStreak", 0)
    total_stars = repo_metrics.get("starCount", 0)

    if streak >= 7:
        highlights.append({
            "id": "streak",
            "label": "🔥 Streak",
            "value": f"{streak} days",
            "detail": f"Longest: {contributions.get('stats', {}).get('longestStreak', 0)} days",
        })

    if total_stars >= 50:
        highlights.append({
            "id": "popular",
            "label": "⭐ Popular",
            "value": f"{total_stars} stars",
        })

    if activity.get("repositoriesContributedTo", 0) >= 5:
        highlights.append({
            "id": "contributor",
            "label": "🌐 Contributor",
            "value": f"{activity['repositoriesContributedTo']} repos",
        })

    yoy = computed.get("yearOverYearGrowth", 0)
    if yoy > 0:
        highlights.append({
            "id": "growth",
            "label": "📈 Growth",
            "value": f"+{yoy}%",
            "detail": "Year over year",
        })

    return {"cards": cards, "highlights": highlights}
