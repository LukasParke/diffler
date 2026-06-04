"""Aggregate data from multiple GitHub profiles into combined stats.

When a user configures multiple usernames (e.g. personal + work),
diffler collects data for each profile independently and then merges
the results so templates see both individual profiles and combined
totals.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def aggregate_results(results_by_user: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Merge per-user collector results into combined stats.

    Args:
        results_by_user: Dict mapping username -> collector results dict.

    Returns:
        Aggregated results dict with the same shape as a single-user
        result, plus a ``profiles`` list for template access.
    """
    if not results_by_user:
        return {}

    if len(results_by_user) == 1:
        # Single user — no aggregation needed
        _username, results = next(iter(results_by_user.items()))
        results["profiles"] = [_extract_profile_summary(results, _username)]
        return results

    profiles: list[dict[str, Any]] = []
    all_repos: list[dict] = []
    all_contributions: list[dict] = []
    all_gists: list[dict] = []
    all_traffic_views: list[dict] = []
    all_traffic_clones: list[dict] = []
    all_contributor_stats: list[dict] = []
    all_activity: list[dict] = []
    all_discussions: list[dict] = []
    all_stars_given: list[dict] = []
    all_repo_contributions: dict[str, dict[str, int]] = {}
    primary_profile: dict[str, Any] = {}

    for username, results in results_by_user.items():
        profiles.append(_extract_profile_summary(results, username))

        if not primary_profile and results.get("profile"):
            primary_profile = dict(results["profile"])
            primary_profile["username"] = username

        if repos := results.get("repositories"):
            all_repos.extend(repos)

        if contrib := results.get("contributions"):
            all_contributions.append(contrib)

        if gists := results.get("gists"):
            all_gists.extend(gists)

        if traffic := results.get("traffic", {}):
            if views := traffic.get("views"):
                all_traffic_views.extend(views)
            if clones := traffic.get("clones"):
                all_traffic_clones.extend(clones)

        if stats := results.get("contributor_stats"):
            all_contributor_stats.extend(stats)

        if activity := results.get("activity"):
            all_activity.append(activity)

        if discussions := results.get("discussions"):
            all_discussions.append(discussions)

        if stars := results.get("stars_given"):
            all_stars_given.extend(stars)

        if repo_contrib := results.get("repo_contributions"):
            for full_name, counts in repo_contrib.items():
                if full_name not in all_repo_contributions:
                    all_repo_contributions[full_name] = dict(counts)
                else:
                    for key, value in counts.items():
                        all_repo_contributions[full_name][key] = (
                            all_repo_contributions[full_name].get(key, 0) + value
                        )

    # Deduplicate repos by full_name (keep the one with most recent push)
    seen_repos: dict[str, dict] = {}
    for repo in all_repos:
        full_name = repo.get("full_name", "")
        if not full_name:
            continue
        if full_name not in seen_repos:
            seen_repos[full_name] = repo
        else:
            # Keep the repo with the most recent push_at
            existing = seen_repos[full_name]
            if _parse_ts(repo.get("pushed_at", "")) > _parse_ts(existing.get("pushed_at", "")):
                seen_repos[full_name] = repo
    deduped_repos = list(seen_repos.values())

    # Aggregate contributions
    aggregated_contributions = _aggregate_contributions(all_contributions)

    # Aggregate activity
    aggregated_activity = _aggregate_activities(all_activity)

    # Aggregate discussions
    aggregated_discussions = _aggregate_discussions(all_discussions)

    return {
        "profile": primary_profile,
        "profiles": profiles,
        "contributions": aggregated_contributions,
        "repositories": deduped_repos,
        "gists": all_gists,
        "traffic": {
            "views": all_traffic_views,
            "clones": all_traffic_clones,
        },
        "contributor_stats": all_contributor_stats,
        "activity": aggregated_activity,
        "discussions": aggregated_discussions,
        "stars_given": all_stars_given,
        "repo_contributions": all_repo_contributions,
    }


def _extract_profile_summary(results: dict[str, Any], username: str) -> dict[str, Any]:
    """Extract a lightweight summary for the ``profiles`` list."""
    profile = results.get("profile", {})
    contributions = results.get("contributions", {})
    repos = results.get("repositories", [])
    return {
        "username": username,
        "name": profile.get("name") or username,
        "avatarUrl": profile.get("avatarUrl") or f"https://avatars.githubusercontent.com/u/{username}",
        "bio": profile.get("bio"),
        "company": profile.get("company"),
        "location": profile.get("location"),
        "followers": profile.get("followers", 0),
        "following": profile.get("following", 0),
        "contributions": contributions.get("totalContributions", 0),
        "currentStreak": contributions.get("currentStreak", 0),
        "repos": len(repos),
        "stars": sum(r.get("stars", 0) for r in repos),
    }


def _aggregate_contributions(contributions_list: list[dict[str, Any]]) -> dict[str, Any]:
    """Sum contributions across multiple profiles."""
    if not contributions_list:
        return {}

    total = 0
    total_commit = 0
    total_issue = 0
    total_pr = 0
    total_review = 0
    restricted = 0
    current_streak = 0
    longest_streak = 0
    calendar_weeks: list[dict] = []

    for contrib in contributions_list:
        total += contrib.get("totalContributions", 0)
        total_commit += contrib.get("totalCommitContributions", 0)
        total_issue += contrib.get("totalIssueContributions", 0)
        total_pr += contrib.get("totalPullRequestContributions", 0)
        total_review += contrib.get("totalPullRequestReviewContributions", 0)
        restricted += contrib.get("restrictedContributionsCount", 0)
        current_streak = max(current_streak, contrib.get("currentStreak", 0))
        longest_streak = max(longest_streak, contrib.get("longestStreak", 0))
        if weeks := contrib.get("calendar", []):
            calendar_weeks.extend(weeks)

    # Merge calendar weeks by summing contribution counts per day
    merged_calendar = _merge_calendars(calendar_weeks)

    return {
        "totalContributions": total,
        "totalCommitContributions": total_commit,
        "totalIssueContributions": total_issue,
        "totalPullRequestContributions": total_pr,
        "totalPullRequestReviewContributions": total_review,
        "restrictedContributionsCount": restricted,
        "currentStreak": current_streak,
        "longestStreak": longest_streak,
        "calendar": merged_calendar,
    }


def _merge_calendars(weeks: list[dict]) -> list[dict]:
    """Merge contribution calendar weeks, summing counts per day."""
    day_counts: dict[str, dict] = {}
    for week in weeks:
        for day in week.get("contributionDays", []):
            date = day.get("date", "")
            if not date:
                continue
            if date not in day_counts:
                day_counts[date] = {
                    "date": date,
                    "contributionCount": day.get("contributionCount", 0),
                    "color": day.get("color", "#ebedf0"),
                }
            else:
                day_counts[date]["contributionCount"] += day.get("contributionCount", 0)
                # Upgrade color if activity increased
                day_counts[date]["color"] = _upgrade_color(
                    day_counts[date]["color"], day.get("color", "#ebedf0")
                )

    # Re-group into weeks (7-day chunks sorted by date)
    sorted_days = sorted(day_counts.values(), key=lambda d: d["date"])
    merged_weeks: list[dict] = []
    current_week: list[dict] = []
    for day in sorted_days:
        current_week.append(day)
        if len(current_week) == 7:
            merged_weeks.append({"contributionDays": current_week})
            current_week = []
    if current_week:
        merged_weeks.append({"contributionDays": current_week})

    return merged_weeks


def _upgrade_color(current: str, new: str) -> str:
    """Return the more active color."""
    # GitHub color scale: #ebedf0 < #9be9a8 < #40c463 < #30a14e < #216e39
    scale = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"]
    try:
        return max(current, new, key=lambda c: scale.index(c) if c in scale else -1)
    except ValueError:
        return current


def _aggregate_activities(activities: list[dict[str, Any]]) -> dict[str, Any]:
    """Sum activity counts across profiles."""
    result: dict[str, int] = {}
    for activity in activities:
        for key, value in activity.items():
            if isinstance(value, int):
                result[key] = result.get(key, 0) + value
    return result


def _aggregate_discussions(discussions_list: list[dict[str, Any]]) -> dict[str, Any]:
    """Sum discussion counts across profiles."""
    result: dict[str, int] = {}
    for discussions in discussions_list:
        for key, value in discussions.items():
            if isinstance(value, int):
                result[key] = result.get(key, 0) + value
    return result


def _parse_ts(iso: str) -> float:
    """Parse ISO timestamp to Unix seconds."""
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return 0.0
