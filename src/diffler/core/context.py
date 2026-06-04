"""Template context builder with lazy data collectors."""

from __future__ import annotations

import logging
from typing import Any

from diffler.collectors.aggregate import aggregate_results
from diffler.collectors.base import CollectorContext
from diffler.collectors.cache import StatsCache
from diffler.collectors.computed import ComputedStatsCollector, RepoStatsCollector
from diffler.collectors.graphql import ContributionsCollector, ProfileCollector
from diffler.collectors.graphql_extended import (
    ActivityCollector,
    DiscussionsCollector,
    MultiYearContributionsCollector,
    RepoContributionsCollector,
    StarsGivenCollector,
)
from diffler.collectors.registry import CollectorRegistry
from diffler.collectors.rest import (
    ContributorStatsCollector,
    GistsCollector,
    OrganizationsCollector,
    RepositoriesRestCollector,
    TrafficCollector,
)
from diffler.collectors.v2_output import build_v2_output
from diffler.config import DifflerConfig
from diffler.github.client import GitHubClient
from diffler.github.graphql import USER_PROFILE_QUERY, parse_user

logger = logging.getLogger(__name__)

_DEFAULT_REGISTRY: CollectorRegistry | None = None


def _get_registry() -> CollectorRegistry:
    """Get the singleton collector registry with built-in collectors."""
    global _DEFAULT_REGISTRY
    if _DEFAULT_REGISTRY is None:
        _DEFAULT_REGISTRY = CollectorRegistry()
        _DEFAULT_REGISTRY.register(ProfileCollector())
        _DEFAULT_REGISTRY.register(ContributionsCollector())
        _DEFAULT_REGISTRY.register(MultiYearContributionsCollector())
        _DEFAULT_REGISTRY.register(OrganizationsCollector())
        _DEFAULT_REGISTRY.register(RepositoriesRestCollector())
        _DEFAULT_REGISTRY.register(TrafficCollector())
        _DEFAULT_REGISTRY.register(ContributorStatsCollector())
        _DEFAULT_REGISTRY.register(GistsCollector())
        _DEFAULT_REGISTRY.register(ActivityCollector())
        _DEFAULT_REGISTRY.register(DiscussionsCollector())
        _DEFAULT_REGISTRY.register(StarsGivenCollector())
        _DEFAULT_REGISTRY.register(RepoContributionsCollector())
        _DEFAULT_REGISTRY.register(RepoStatsCollector())
        _DEFAULT_REGISTRY.register(ComputedStatsCollector())
    return _DEFAULT_REGISTRY


class ContextBuilder:
    """Builds the template context by merging all data sources.

    Uses lazy collectors: only fetches data points that templates reference.
    """

    def __init__(self, config: DifflerConfig) -> None:
        self.config = config
        self.registry = _get_registry()
        self.cache = self._init_cache()

    def _init_cache(self) -> StatsCache:
        """Initialize cache from config settings."""
        if not self.config.cache.enabled:
            return StatsCache(stable_path=None, volatile_path=None)
        if self.config.cache.directory:
            stable = self.config.cache.directory / "cache.json"
            volatile = self.config.cache.directory / "volatile-cache.json"
            return StatsCache(stable_path=stable, volatile_path=volatile)
        return StatsCache()

    def build(self, template_source: str = "") -> dict[str, Any]:
        """Assemble the full template context.

        If a template source is provided, analyzes it to determine which
        collectors to run. Otherwise falls back to the legacy live API.
        """
        if template_source:
            return self._build_with_collectors(template_source)
        return self._build_legacy()

    def _build_with_collectors(self, template_source: str) -> dict[str, Any]:
        """Run only the collectors needed by the template.

        Supports multi-profile aggregation when ``github.usernames`` is set.
        """
        usernames = self.config.github.get_usernames()
        if not usernames:
            logger.warning("No GitHub usernames configured; using stub data.")
            return self._build_single_user(template_source, stub=True)

        if len(usernames) == 1:
            return self._build_single_user(template_source)

        # Multi-profile mode: collect for each user, then aggregate
        return self._build_multi_user(template_source, usernames)

    def _build_single_user(
        self, template_source: str, *, stub: bool = False
    ) -> dict[str, Any]:
        """Collect and build context for a single user."""
        ctx = CollectorContext(self.config, cache=self.cache)

        if stub:
            return self._build_context_from_results(ctx.results)

        needed = self.registry.discover_needed(template_source)
        self._run_collectors(needed, ctx)

        if self.config.cache.enabled:
            self.cache.save()

        return self._build_context_from_results(ctx.results)

    def _build_multi_user(
        self, template_source: str, usernames: list[str]
    ) -> dict[str, Any]:
        """Collect data for multiple users and aggregate."""
        results_by_user: dict[str, dict[str, Any]] = {}

        for username in usernames:
            logger.info("Collecting data for %s", username)
            # Temporarily override username in config
            original_username = self.config.github.username
            self.config.github.username = username

            try:
                ctx = CollectorContext(self.config, cache=self.cache)
                needed = self.registry.discover_needed(template_source)
                self._run_collectors(needed, ctx)
                results_by_user[username] = dict(ctx.results)
            except Exception:
                logger.exception("Failed to collect data for %s", username)
                results_by_user[username] = {}
            finally:
                self.config.github.username = original_username

        if self.config.cache.enabled:
            self.cache.save()

        aggregated = aggregate_results(results_by_user)
        return self._build_context_from_results(aggregated, multi_profile=True)

    def _run_collectors(self, needed: list[str], ctx: CollectorContext) -> None:
        """Execute collectors and store collection status."""
        if not needed:
            return

        statuses = self.registry.run(needed, ctx)
        collection_status: dict[str, Any] = {
            "complete": True,
            "coreComplete": True,
            "backfillPending": 0,
            "backfillCompletedThisRun": 0,
            "backfillFailedThisRun": 0,
            "warnings": [],
            "errors": [],
            "timestamp": "",
        }

        success = sum(1 for s in statuses.values() if s == "success")
        failed = sum(1 for s in statuses.values() if s == "failed")
        skipped = sum(1 for s in statuses.values() if s == "skipped")
        collection_status["backfillCompletedThisRun"] = success
        collection_status["backfillFailedThisRun"] = failed
        collection_status["backfillPending"] = skipped
        for name, status in statuses.items():
            if status == "failed":
                collection_status["errors"].append(f"Collector {name} failed")
            elif status == "skipped":
                collection_status["warnings"].append(f"Collector {name} skipped (rate limit)")
        collection_status["complete"] = failed == 0
        collection_status["coreComplete"] = all(
            statuses.get(n) == "success"
            for n in ("profile", "contributions")
            if n in statuses
        )

        ctx.results["_collection_status"] = collection_status

    def _build_context_from_results(
        self, results: dict[str, Any], *, multi_profile: bool = False
    ) -> dict[str, Any]:
        """Build the template context from collector results."""
        stats = build_v2_output(results)

        profile = results.get("profile", {})
        contributions = results.get("contributions", {})
        repos = results.get("repositories", [])
        profiles = results.get("profiles", [])

        ctx: dict[str, Any] = {
            "config": self.config,
            "github": {
                "user": {
                    "login": profile.get("login") or self.config.github.username or "unknown",
                    "name": profile.get("name") or self.config.github.username or "unknown",
                    "bio": profile.get("bio"),
                    "company": profile.get("company"),
                    "location": profile.get("location"),
                    "website_url": profile.get("websiteUrl"),
                    "twitter_username": profile.get("twitterUsername"),
                    "email": profile.get("email"),
                    "created_at": profile.get("createdAt"),
                    "followers": profile.get("followers", 0),
                    "following": profile.get("following", 0),
                    "starred_repositories": profile.get("starredRepositories", 0),
                    "repositories": repos,
                    "pinned_repositories": [],
                    "contributions": {
                        "total": contributions.get("totalContributions", 0),
                        "commits": contributions.get("totalCommitContributions", 0),
                        "issues": contributions.get("totalIssueContributions", 0),
                        "pull_requests": contributions.get("totalPullRequestContributions", 0),
                        "reviews": contributions.get("totalPullRequestReviewContributions", 0),
                        "calendar": contributions.get("calendar", []),
                    },
                },
            },
            "stats": stats,
            "profile": profile,
            "profiles": profiles,
            "contributions": contributions,
            "repositories": repos,
            "gists": results.get("gists", []),
            "traffic": results.get("traffic", {}),
            "contributor_stats": results.get("contributor_stats", []),
            "activity": results.get("activity", {}),
            "discussions": results.get("discussions", {}),
            "stars_given": results.get("stars_given", []),
            "repo_contributions": results.get("repo_contributions", {}),
            "repo_stats": results.get("repo_stats", {}),
            "computed_stats": results.get("computed_stats", {}),
            "collection_status": results.get("_collection_status", {}),
            "multi_profile": multi_profile,
        }

        return ctx

    def _build_legacy(self) -> dict[str, Any]:
        """Fallback: fetch user data via the original live API path."""
        context: dict[str, Any] = {
            "config": self.config,
            "github": {
                "user": self._fetch_user_or_stub(),
            },
        }
        return context

    def _fetch_user_or_stub(self) -> dict[str, Any]:
        """Fetch real user data from GitHub API, or return a stub."""
        username = self.config.github.username
        token = self.config.github.token

        if not username:
            logger.warning("No GitHub username configured; using stub data.")
            return self._stub_user()

        if not token or token.startswith("${"):
            logger.warning("No GitHub token configured; using stub data.")
            return self._stub_user()

        try:
            client = GitHubClient(self.config.github)
            data = client.graphql_query(
                USER_PROFILE_QUERY,
                variables={"login": username},
            )
            user = parse_user(data)
            client.close()
            logger.info("Fetched GitHub profile for %s", username)
            return user
        except Exception:
            logger.exception(
                "Failed to fetch GitHub profile for %s; using stub data", username
            )
            return self._stub_user()

    def _stub_user(self) -> dict[str, Any]:
        """Return minimal stub user data for offline/render-only use."""
        username = self.config.github.username or "unknown"
        return {
            "login": username,
            "name": username,
            "bio": None,
            "company": None,
            "location": None,
            "website_url": None,
            "twitter_username": None,
            "followers": 0,
            "following": 0,
            "public_repos": 0,
            "repositories": [],
            "pinned_repositories": [],
            "contributions": {
                "total": 0,
                "commits": 0,
                "issues": 0,
                "pull_requests": 0,
                "reviews": 0,
                "calendar": [],
            },
        }
