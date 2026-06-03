"""Format collected data into stats-action schema v2 output.

This ensures backward compatibility with existing consumers of the
github-user-stats.json format.
"""

from __future__ import annotations

from typing import Any


def build_v2_output(ctx_results: dict[str, Any]) -> dict[str, Any]:
    """Build a schema v2 stats dict from collector results.

    Args:
        ctx_results: The ``results`` dict from a CollectorContext.

    Returns:
        Schema v2-compatible stats JSON.
    """
    profile = ctx_results.get("profile", {})
    contributions = ctx_results.get("contributions", {})
    repos = ctx_results.get("repositories", [])
    gists = ctx_results.get("gists", [])
    repo_stats = ctx_results.get("repo_stats", {})
    computed_stats = ctx_results.get("computed_stats", {})
    activity = ctx_results.get("activity", {})

    # Build top languages from repository data
    lang_bytes: dict[str, dict] = {}
    for repo in repos:
        for lang in repo.get("languages", []):
            name = lang.get("name")
            if not name:
                continue
            if name not in lang_bytes:
                lang_bytes[name] = {
                    "languageName": name,
                    "color": lang.get("color"),
                    "value": 0,
                }
            lang_bytes[name]["value"] += lang.get("size", 0)

    total_bytes = sum(l["value"] for l in lang_bytes.values())
    top_languages = sorted(lang_bytes.values(), key=lambda l: l["value"], reverse=True)
    for lang in top_languages:
        lang["percentage"] = round((lang["value"] / total_bytes) * 100, 2) if total_bytes else 0

    # Build top topics
    topic_counts: dict[str, int] = {}
    for repo in repos:
        for topic in repo.get("topics", []):
            if topic:
                topic_counts[topic] = topic_counts.get(topic, 0) + 1
    top_topics = [
        {"topic": t, "count": c}
        for t, c in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)
    ][:20]

    public_repos = [r for r in repos if not r.get("is_private")]
    total_stars = sum(r.get("stars", 0) for r in repos)
    total_forks = sum(r.get("forks", 0) for r in repos)

    # Aggregate from backfill collectors if present
    traffic = ctx_results.get("traffic", {})
    contributor_stats = ctx_results.get("contributor_stats", [])
    total_views = sum(v.get("count", 0) for v in traffic.get("views", []))
    total_additions = sum(c.get("additions", 0) for c in contributor_stats)
    total_deletions = sum(c.get("deletions", 0) for c in contributor_stats)

    # Metric cards for remotion
    cards = _build_metric_cards(ctx_results)
    highlights = _build_highlights(ctx_results)

    # Collection status
    collection_status = ctx_results.get("_collection_status", {})

    return {
        "schemaVersion": 2,
        "name": profile.get("name"),
        "username": profile.get("login"),
        "avatarUrl": f"https://avatars.githubusercontent.com/u/{profile.get('login', '')}",
        "bio": profile.get("bio"),
        "company": profile.get("company"),
        "location": profile.get("location"),
        "email": profile.get("email"),
        "twitterUsername": profile.get("twitterUsername"),
        "websiteUrl": profile.get("websiteUrl"),
        "createdAt": profile.get("createdAt"),
        "followers": profile.get("followers", 0),
        "following": profile.get("following", 0),
        "starredRepositories": profile.get("starredRepositories", 0),
        "publicGists": len(gists),
        "totalCommits": contributions.get("totalCommitContributions", 0),
        "totalPullRequests": contributions.get("totalPullRequestContributions", 0),
        "totalPullRequestReviews": contributions.get("totalPullRequestReviewContributions", 0),
        "commitCount": contributions.get("totalCommitContributions", 0),
        "linesOfCodeChanged": total_additions + total_deletions,
        "linesAdded": total_additions,
        "linesDeleted": total_deletions,
        "linesChanged": total_additions + total_deletions,
        "repoViews": total_views,
        "repoViewUniques": sum(v.get("uniques", 0) for v in traffic.get("views", [])),
        "codeByteTotal": total_bytes,
        "topLanguages": top_languages,
        "topTopics": top_topics,
        "starsGiven": activity.get("starsGiven", 0),
        "openIssues": activity.get("openIssues", 0),
        "closedIssues": activity.get("closedIssues", 0),
        "repositoriesContributedTo": activity.get("repositoriesContributedTo", 0),
        "discussionsStarted": activity.get("discussionsStarted", 0),
        "discussionsAnswered": activity.get("discussionsAnswered", 0),
        "profileContributions": {
            "totalContributions": contributions.get("totalContributions", 0),
            "totalCommitContributions": contributions.get("totalCommitContributions", 0),
            "totalIssueContributions": contributions.get("totalIssueContributions", 0),
            "totalPullRequestContributions": contributions.get("totalPullRequestContributions", 0),
            "totalPullRequestReviewContributions": contributions.get("totalPullRequestReviewContributions", 0),
            "totalRepositoryContributions": len(repos),
            "restrictedContributionsCount": contributions.get("restrictedContributionsCount", 0),
            "contributionCalendar": {
                "totalContributions": contributions.get("totalContributions", 0),
                "weeks": contributions.get("calendar", []),
            },
            "stats": {
                "currentStreak": contributions.get("currentStreak", 0),
                "longestStreak": contributions.get("longestStreak", 0),
                "longestStreakStartDate": contributions.get("longestStreakStartDate", ""),
                "longestStreakEndDate": contributions.get("longestStreakEndDate", ""),
            },
        },
        "activity": activity,
        "repositories": [
            {
                "name": r.get("name"),
                "full_name": r.get("full_name"),
                "description": r.get("description"),
                "url": r.get("url"),
                "stars": r.get("stars", 0),
                "forks": r.get("forks", 0),
                "language": r.get("primary_language"),
                "language_color": r.get("primary_language_color"),
                "isPrivate": r.get("is_private", False),
                "isFork": r.get("is_fork", False),
                "isArchived": r.get("is_archived", False),
                "topics": r.get("topics", []),
                "createdAt": r.get("created_at"),
                "pushedAt": r.get("pushed_at"),
                "updatedAt": r.get("updated_at"),
                "owner": r.get("owner"),
                "ownerType": r.get("owner_type"),
                "visibility": r.get("visibility"),
            }
            for r in repos
        ],
        "repoMetrics": {
            "starCount": total_stars,
            "forkCount": total_forks,
            "codeByteTotal": total_bytes,
            "topLanguages": top_languages,
            "topTopics": top_topics,
            "publicRepoCount": len(public_repos),
            "contributorStats": contributor_stats,
            "traffic": traffic,
            "repoStats": repo_stats,
            "computedStats": computed_stats,
        },
        "repoStats": repo_stats,
        "computedStats": computed_stats,
        "cards": cards,
        "highlights": highlights,
        "presentation": {
            "readmeSummary": {
                "contributions": contributions.get("totalContributions", 0),
                "streak": contributions.get("currentStreak", 0),
                "repos": len(repos),
                "stars": total_stars,
            },
            "remotion": {
                "username": profile.get("login"),
                "totalContributions": contributions.get("totalContributions", 0),
                "currentStreak": contributions.get("currentStreak", 0),
                "longestStreak": contributions.get("longestStreak", 0),
                "topLanguages": [
                    {"name": l["languageName"], "percentage": l["percentage"]}
                    for l in top_languages[:6]
                ],
            },
        },
        "privacy": {
            "includePrivateDetails": True,
            "redactedEntries": 0,
        },
        "collectionStatus": {
            "complete": collection_status.get("complete", True),
            "coreComplete": collection_status.get("coreComplete", True),
            "backfillPending": collection_status.get("backfillPending", 0),
            "backfillCompletedThisRun": collection_status.get("backfillCompletedThisRun", 0),
            "backfillFailedThisRun": collection_status.get("backfillFailedThisRun", 0),
            "warnings": collection_status.get("warnings", []),
            "errors": collection_status.get("errors", []),
            "timestamp": collection_status.get("timestamp", ""),
        },
    }


def _build_metric_cards(ctx_results: dict[str, Any]) -> list[dict[str, Any]]:
    """Generate metric cards for remotion consumption."""
    profile = ctx_results.get("profile", {})
    contributions = ctx_results.get("contributions", {})
    repos = ctx_results.get("repositories", [])
    activity = ctx_results.get("activity", {})

    cards: list[dict[str, Any]] = [
        {
            "id": "contributions",
            "label": "Contributions",
            "value": contributions.get("totalContributions", 0),
        },
        {
            "id": "commits",
            "label": "Commits",
            "value": contributions.get("totalCommitContributions", 0),
        },
        {
            "id": "pull-requests",
            "label": "Pull Requests",
            "value": activity.get("totalPullRequests", contributions.get("totalPullRequestContributions", 0)),
        },
        {
            "id": "issues",
            "label": "Issues",
            "value": activity.get("closedIssues", 0),
        },
        {
            "id": "repositories",
            "label": "Repositories",
            "value": len(repos),
        },
        {
            "id": "stars",
            "label": "Stars",
            "value": sum(r.get("stars", 0) for r in repos),
        },
        {
            "id": "followers",
            "label": "Followers",
            "value": profile.get("followers", 0),
        },
    ]

    streak = contributions.get("currentStreak", 0)
    if streak > 0:
        cards.append({
            "id": "streak",
            "label": "Current Streak",
            "value": f"{streak} days",
        })

    return cards


def _build_highlights(ctx_results: dict[str, Any]) -> list[dict[str, Any]]:
    """Generate highlight cards — the most impressive metrics."""
    contributions = ctx_results.get("contributions", {})
    repos = ctx_results.get("repositories", [])
    activity = ctx_results.get("activity", {})
    computed = ctx_results.get("computed_stats", {})

    highlights: list[dict[str, Any]] = []
    total_stars = sum(r.get("stars", 0) for r in repos)

    if contributions.get("currentStreak", 0) >= 7:
        highlights.append({
            "id": "streak",
            "label": "🔥 Streak",
            "value": f"{contributions['currentStreak']} days",
            "detail": f"Longest: {contributions.get('longestStreak', 0)} days",
        })

    if total_stars >= 50:
        highlights.append({
            "id": "popular",
            "label": "⭐ Popular",
            "value": f"{total_stars} stars",
            "detail": f"Across {len(repos)} repos",
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

    return highlights
