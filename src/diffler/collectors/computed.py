"""Computed collectors that derive stats from already-fetched data.

These collectors perform no API calls — they aggregate, filter, and
compute derived metrics from the results of other collectors.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from diffler.collectors.base import Collector, CollectorContext

logger = logging.getLogger(__name__)


class RepoStatsCollector(Collector):
    """Compute aggregate repository statistics from the repo list.

    No API calls — purely derived from ctx.results["repositories"].
    """

    name = "repo_stats"
    template_refs = {"repoStats", "repositories", "stats"}
    optional = True

    def collect(self, ctx: CollectorContext) -> dict[str, Any]:
        repos = ctx.get("repositories", [])
        if not repos:
            return {}

        now = datetime.now(timezone.utc)
        current_year = now.year
        ninety_days_ago = now.timestamp() - 90 * 24 * 3600

        total = len(repos)
        public_repos = [r for r in repos if r.get("visibility") == "PUBLIC" or not r.get("is_private")]
        private_repos = [r for r in repos if r.get("is_private")]
        archived = [r for r in repos if r.get("is_archived")]
        forked = [r for r in repos if r.get("is_fork")]
        original = [r for r in repos if not r.get("is_fork")]
        with_stars = [r for r in repos if r.get("stars", 0) > 0]

        created_this_year = [
            r for r in repos
            if r.get("created_at") and _parse_year(r["created_at"]) == current_year
        ]

        active = [
            r for r in repos
            if r.get("pushed_at") and _parse_ts(r["pushed_at"]) > ninety_days_ago
        ]

        total_stars = sum(r.get("stars", 0) for r in repos)

        return {
            "totalRepos": total,
            "publicRepos": len(public_repos),
            "privateRepos": len(private_repos),
            "archivedRepos": len(archived),
            "forkedRepos": len(forked),
            "originalRepos": len(original),
            "activeRepos": len(active),
            "reposWithStars": len(with_stars),
            "reposCreatedThisYear": len(created_this_year),
            "averageStarsPerRepo": round(total_stars / total, 1) if total else 0,
        }


class ComputedStatsCollector(Collector):
    """Compute cross-year and language-derived statistics.

    Combines repository data, contributions data, and language
    breakdowns into high-level computed metrics.
    """

    name = "computed_stats"
    template_refs = {"computedStats", "stats"}
    dependencies = {"repositories", "contributions", "multi_year_contributions"}
    optional = True

    def collect(self, ctx: CollectorContext) -> dict[str, Any]:
        repos = ctx.get("repositories", [])
        contributions = ctx.get("contributions", {})

        now = datetime.now(timezone.utc)
        current_year = now.year
        current_year_start = datetime(current_year, 1, 1, tzinfo=timezone.utc).timestamp()

        # Language stats across all repos
        lang_bytes: dict[str, int] = {}
        for repo in repos:
            for lang in repo.get("languages", []):
                name = lang.get("name")
                if name:
                    lang_bytes[name] = lang_bytes.get(name, 0) + lang.get("size", 0)

        sorted_langs = sorted(lang_bytes.items(), key=lambda x: x[1], reverse=True)
        primary_language = sorted_langs[0][0] if sorted_langs else None

        # Language stats for repos active this year
        lang_bytes_this_year: dict[str, int] = {}
        for repo in repos:
            pushed = repo.get("pushed_at")
            if pushed and _parse_ts(pushed) >= current_year_start:
                for lang in repo.get("languages", []):
                    name = lang.get("name")
                    if name:
                        lang_bytes_this_year[name] = lang_bytes_this_year.get(name, 0) + lang.get("size", 0)

        sorted_this_year = sorted(lang_bytes_this_year.items(), key=lambda x: x[1], reverse=True)
        primary_this_year = sorted_this_year[0][0] if sorted_this_year else None

        total_bytes = sum(lang_bytes.values())
        top_languages = [
            {
                "languageName": name,
                "value": bytes_count,
                "percentage": round((bytes_count / total_bytes) * 100, 2) if total_bytes else 0,
            }
            for name, bytes_count in sorted_langs[:10]
        ]

        top_this_year = [
            {
                "languageName": name,
                "value": bytes_count,
                "percentage": round((bytes_count / sum(lang_bytes_this_year.values())) * 100, 2) if lang_bytes_this_year else 0,
            }
            for name, bytes_count in sorted_this_year[:10]
        ]

        # Topic aggregation
        all_topics: set[str] = set()
        topic_counts: dict[str, int] = {}
        for repo in repos:
            for topic in repo.get("topics", []):
                if topic:
                    all_topics.add(topic)
                    topic_counts[topic] = topic_counts.get(topic, 0) + 1

        total_contributions = contributions.get("totalContributions", 0)
        multi_year = ctx.get("multi_year_contributions", {})
        last_year_contributions = multi_year.get("lastYearContributions", 0)
        yoy = 0.0
        if last_year_contributions > 0:
            yoy = round(((total_contributions - last_year_contributions) / last_year_contributions) * 100, 1)

        return {
            "totalRepos": len(repos),
            "publicRepos": len([r for r in repos if not r.get("is_private")]),
            "privateRepos": len([r for r in repos if r.get("is_private")]),
            "archivedRepos": len([r for r in repos if r.get("is_archived")]),
            "forkedRepos": len([r for r in repos if r.get("is_fork")]),
            "originalRepos": len([r for r in repos if not r.get("is_fork")]),
            "activeRepos": len([r for r in repos if r.get("pushed_at") and _parse_ts(r["pushed_at"]) > now.timestamp() - 90 * 24 * 3600]),
            "reposWithStars": len([r for r in repos if r.get("stars", 0) > 0]),
            "reposCreatedThisYear": len([r for r in repos if r.get("created_at") and _parse_year(r["created_at"]) == current_year]),
            "averageStarsPerRepo": round(sum(r.get("stars", 0) for r in repos) / len(repos), 1) if repos else 0,
            "languageCount": len(lang_bytes),
            "primaryLanguage": primary_language,
            "primaryLanguageThisYear": primary_this_year,
            "topLanguagesThisYear": top_this_year,
            "contributionsThisYear": total_contributions,
            "contributionsLastYear": last_year_contributions,
            "yearOverYearGrowth": yoy,
            "totalTopics": len(all_topics),
            "topTopics": [
                {"topic": t, "count": c}
                for t, c in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)
            ][:20],
            "allTopics": sorted(list(all_topics)),
        }


def _parse_ts(iso: str) -> float:
    """Parse an ISO 8601 timestamp to Unix seconds."""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return 0.0


def _parse_year(iso: str) -> int:
    """Extract the year from an ISO 8601 timestamp."""
    try:
        return int(iso[:4])
    except Exception:
        return 0
