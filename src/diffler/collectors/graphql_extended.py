"""Additional GraphQL collectors for full stats-action parity."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from diffler.collectors.base import Collector, CollectorContext
from diffler.github.client import GitHubClient

logger = logging.getLogger(__name__)

MULTI_YEAR_CONTRIBUTIONS_QUERY = """
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            color
          }
        }
      }
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
    }
  }
}
"""

ACTIVITY_QUERY = """
query($login: String!) {
  user(login: $login) {
    pullRequests(first: 1) {
      totalCount
    }
    issues(first: 1) {
      totalCount
    }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
      totalCount
    }
    starredRepositories(first: 1) {
      totalCount
    }
  }
}
"""

DISCUSSIONS_QUERY = """
query($login: String!) {
  user(login: $login) {
    repositoryDiscussions(first: 1) {
      totalCount
    }
  }
}
"""

STARS_GIVEN_QUERY = """
query($login: String!, $first: Int!, $after: String) {
  user(login: $login) {
    starredRepositories(first: $first, after: $after) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        nameWithOwner
        stargazerCount
        primaryLanguage {
          name
        }
      }
    }
  }
}
"""

REPO_CONTRIBUTIONS_QUERY = """
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository {
          nameWithOwner
          id
        }
        contributions {
          totalCount
        }
      }
    }
  }
}
"""


class MultiYearContributionsCollector(Collector):
    """Fetch contribution calendar for the previous year for YoY comparison."""

    name = "multi_year_contributions"
    template_refs = {"computedStats", "stats", "yearOverYearGrowth", "contributionsLastYear"}
    optional = True

    def collect(self, ctx: CollectorContext) -> dict[str, Any]:
        cache_key = f"graphql_contributions_last_year:{ctx.config.github.username}"
        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        from datetime import datetime, timedelta, timezone

        client = GitHubClient(ctx.config.github)
        now = datetime.now(timezone.utc)
        last_year_start = now.replace(year=now.year - 1) - timedelta(days=365)
        last_year_end = last_year_start + timedelta(days=365)

        try:
            data = client.graphql_query(
                MULTI_YEAR_CONTRIBUTIONS_QUERY,
                variables={
                    "login": ctx.config.github.username,
                    "from": last_year_start.isoformat(),
                    "to": last_year_end.isoformat(),
                },
            )
        finally:
            client.close()

        collection = data.get("user", {}).get("contributionsCollection", {})
        calendar = collection.get("contributionCalendar", {})

        result = {
            "lastYearContributions": calendar.get("totalContributions", 0),
            "lastYearCalendar": calendar.get("weeks", []),
            "lastYearCommitContributions": collection.get("totalCommitContributions", 0),
            "lastYearIssueContributions": collection.get("totalIssueContributions", 0),
            "lastYearPullRequestContributions": collection.get("totalPullRequestContributions", 0),
        }
        ctx.cache.set_stable(cache_key, result)
        return result


class ActivityCollector(Collector):
    """Collect high-level activity counts: PRs, issues, repos contributed to, stars given."""

    name = "activity"
    template_refs = {"activity", "totalPullRequests", "openIssues", "closedIssues", "repositoriesContributedTo", "starsGiven"}
    optional = True

    def collect(self, ctx: CollectorContext) -> dict[str, Any]:
        cache_key = f"graphql_activity:{ctx.config.github.username}"
        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        client = GitHubClient(ctx.config.github)
        try:
            data = client.graphql_query(
                ACTIVITY_QUERY,
                variables={"login": ctx.config.github.username},
            )
        finally:
            client.close()

        user = data.get("user", {})

        # We need open/closed issue counts — GraphQL user.issues doesn't filter by state easily
        # in a single query, so we fetch via REST as fallback
        open_issues, closed_issues = self._fetch_issue_counts(ctx)

        result = {
            "totalPullRequests": user.get("pullRequests", {}).get("totalCount", 0),
            "openIssues": open_issues,
            "closedIssues": closed_issues,
            "repositoriesContributedTo": user.get("repositoriesContributedTo", {}).get("totalCount", 0),
            "starsGiven": user.get("starredRepositories", {}).get("totalCount", 0),
        }
        ctx.cache.set_stable(cache_key, result)
        return result

    def _fetch_issue_counts(self, ctx: CollectorContext) -> tuple[int, int]:
        """Fetch open and closed issue counts via REST search API."""
        username = ctx.config.github.username
        client = GitHubClient(ctx.config.github)
        open_count = 0
        closed_count = 0
        try:
            open_data = client.rest_get(
                "/search/issues",
                params={"q": f"author:{username} type:issue state:open", "per_page": 1},
            )
            open_count = open_data.get("total_count", 0)

            closed_data = client.rest_get(
                "/search/issues",
                params={"q": f"author:{username} type:issue state:closed", "per_page": 1},
            )
            closed_count = closed_data.get("total_count", 0)
        except Exception:
            logger.debug("Failed to fetch issue counts via search API")
        finally:
            client.close()
        return open_count, closed_count


class DiscussionsCollector(Collector):
    """Collect GitHub Discussions participation counts."""

    name = "discussions"
    template_refs = {"discussionsStarted", "discussionsAnswered", "activity"}
    optional = True

    def collect(self, ctx: CollectorContext) -> dict[str, Any]:
        cache_key = f"graphql_discussions:{ctx.config.github.username}"
        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        client = GitHubClient(ctx.config.github)
        try:
            data = client.graphql_query(
                DISCUSSIONS_QUERY,
                variables={"login": ctx.config.github.username},
            )
        finally:
            client.close()

        user = data.get("user", {})
        result = {
            "discussionsStarted": user.get("repositoryDiscussions", {}).get("totalCount", 0),
            "discussionsAnswered": 0,  # Requires complex repository-level query; placeholder
        }
        ctx.cache.set_stable(cache_key, result)
        return result


class StarsGivenCollector(Collector):
    """Collect list of starred repositories with metadata.

    Note: This paginates through ALL starred repos. For users with
    thousands of stars, this can be slow. Consider limiting or
    making it optional.
    """

    name = "stars_given"
    template_refs = {"starsGiven", "starredRepositories", "activity"}
    optional = True

    def collect(self, ctx: CollectorContext) -> list[dict[str, Any]]:
        cache_key = f"graphql_stars_given:{ctx.config.github.username}"
        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        client = GitHubClient(ctx.config.github)
        all_stars: list[dict] = []
        after = None

        try:
            while True:
                variables = {"login": ctx.config.github.username, "first": 100}
                if after:
                    variables["after"] = after

                data = client.graphql_query(STARS_GIVEN_QUERY, variables=variables)
                stars_data = data.get("user", {}).get("starredRepositories", {})
                nodes = stars_data.get("nodes", [])

                for node in nodes:
                    all_stars.append({
                        "nameWithOwner": node.get("nameWithOwner"),
                        "stars": node.get("stargazerCount", 0),
                        "primaryLanguage": (node.get("primaryLanguage") or {}).get("name"),
                    })

                page_info = stars_data.get("pageInfo", {})
                if not page_info.get("hasNextPage"):
                    break
                after = page_info.get("endCursor")

                if len(all_stars) >= 1000:  # Safety limit
                    break
        finally:
            client.close()

        ctx.cache.set_stable(cache_key, all_stars)
        return all_stars


class RepoContributionsCollector(Collector):
    """Fetch per-repository contribution breakdown for the past year."""

    name = "repo_contributions"
    template_refs = {"repo_contributions", "repositories"}
    optional = True

    def collect(self, ctx: CollectorContext) -> dict[str, dict[str, int]]:
        cache_key = f"graphql_repo_contributions:{ctx.config.github.username}"
        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        from datetime import datetime, timedelta, timezone

        client = GitHubClient(ctx.config.github)
        now = datetime.now(timezone.utc)
        one_year_ago = now - timedelta(days=365)

        try:
            data = client.graphql_query(
                REPO_CONTRIBUTIONS_QUERY,
                variables={
                    "login": ctx.config.github.username,
                    "from": one_year_ago.isoformat(),
                    "to": now.isoformat(),
                },
            )
        finally:
            client.close()

        collection = data.get("user", {}).get("contributionsCollection", {})
        by_repo = collection.get("commitContributionsByRepository", [])

        result: dict[str, dict[str, int]] = {}
        for entry in by_repo:
            repo = entry.get("repository", {})
            full_name = repo.get("nameWithOwner")
            contributions = entry.get("contributions", {})
            if full_name:
                result[full_name] = {
                    "commits": contributions.get("totalCount", 0),
                }

        ctx.cache.set_stable(cache_key, result)
        return result
