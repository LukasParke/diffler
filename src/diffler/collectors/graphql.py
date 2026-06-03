"""GraphQL-based data collectors."""

from __future__ import annotations

import logging
from typing import Any

from diffler.collectors.base import Collector, CollectorContext
from diffler.github.client import GitHubClient

logger = logging.getLogger(__name__)

PROFILE_QUERY = """
query($login: String!) {
  user(login: $login) {
    login
    name
    bio
    company
    location
    websiteUrl
    twitterUsername
    email
    createdAt
    followers {
      totalCount
    }
    following {
      totalCount
    }
    starredRepositories {
      totalCount
    }
  }
}
"""

CONTRIBUTIONS_QUERY = """
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

REPOS_QUERY = """
query($login: String!, $first: Int!, $after: String) {
  user(login: $login) {
    repositories(
      first: $first,
      after: $after,
      ownerAffiliations: [OWNER],
      orderBy: {field: PUSHED_AT, direction: DESC}
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        nameWithOwner
        description
        url
        homepageUrl
        isPrivate
        isFork
        isArchived
        stargazerCount
        forkCount
        primaryLanguage {
          name
          color
        }
        languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node {
              name
              color
            }
          }
        }
        repositoryTopics(first: 5) {
          nodes {
            topic {
              name
            }
          }
        }
        defaultBranchRef {
          name
        }
        createdAt
        pushedAt
      }
    }
  }
}
"""


def _compute_streaks(calendar_weeks: list[dict]) -> dict[str, Any]:
    """Compute current and longest streak from contribution calendar."""
    days = []
    for week in calendar_weeks:
        for day in week.get("contributionDays", []):
            days.append(day)

    current_streak = 0
    longest_streak = 0
    streak_temp = 0
    longest_start = ""
    longest_end = ""
    temp_start = ""

    for i, day in enumerate(reversed(days)):
        count = day.get("contributionCount", 0)
        date = day.get("date", "")
        if count > 0:
            if streak_temp == 0:
                temp_start = date
            streak_temp += 1
            if i == 0:
                current_streak = streak_temp
        else:
            if streak_temp > longest_streak:
                longest_streak = streak_temp
                longest_start = temp_start
                longest_end = days[len(days) - i].get("date", "") if i > 0 else temp_start
            streak_temp = 0

    if streak_temp > longest_streak:
        longest_streak = streak_temp
        longest_start = temp_start
        longest_end = days[-1].get("date", "") if days else ""

    return {
        "currentStreak": current_streak,
        "longestStreak": longest_streak,
        "longestStreakStartDate": longest_start,
        "longestStreakEndDate": longest_end,
    }


class ProfileCollector(Collector):
    """Collect user profile identity and social counts."""

    name = "profile"
    template_refs = {"profile", "github"}

    def collect(self, ctx: CollectorContext) -> dict[str, Any]:
        cache_key = f"graphql_profile:{ctx.config.github.username}"
        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        client = GitHubClient(ctx.config.github)
        try:
            data = client.graphql_query(
                PROFILE_QUERY,
                variables={"login": ctx.config.github.username},
            )
        finally:
            client.close()

        user = data.get("user", {})
        result = {
            "login": user.get("login"),
            "name": user.get("name") or user.get("login"),
            "bio": user.get("bio"),
            "company": user.get("company"),
            "location": user.get("location"),
            "websiteUrl": user.get("websiteUrl"),
            "twitterUsername": user.get("twitterUsername"),
            "email": user.get("email"),
            "createdAt": user.get("createdAt"),
            "followers": user.get("followers", {}).get("totalCount", 0),
            "following": user.get("following", {}).get("totalCount", 0),
            "starredRepositories": user.get("starredRepositories", {}).get("totalCount", 0),
        }
        ctx.cache.set_stable(cache_key, result)
        return result


class ContributionsCollector(Collector):
    """Collect contribution calendar and totals for the past year."""

    name = "contributions"
    template_refs = {"contributions", "streak", "calendar"}
    optional = True

    def collect(self, ctx: CollectorContext) -> dict[str, Any]:
        from datetime import datetime, timedelta, timezone

        cache_key = f"graphql_contributions:{ctx.config.github.username}"
        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        client = GitHubClient(ctx.config.github)
        now = datetime.now(timezone.utc)
        one_year_ago = now - timedelta(days=365)

        try:
            data = client.graphql_query(
                CONTRIBUTIONS_QUERY,
                variables={
                    "login": ctx.config.github.username,
                    "from": one_year_ago.isoformat(),
                    "to": now.isoformat(),
                },
            )
        finally:
            client.close()

        collection = data.get("user", {}).get("contributionsCollection", {})
        calendar = collection.get("contributionCalendar", {})
        streaks = _compute_streaks(calendar.get("weeks", []))

        result = {
            "totalContributions": calendar.get("totalContributions", 0),
            "totalCommitContributions": collection.get("totalCommitContributions", 0),
            "totalIssueContributions": collection.get("totalIssueContributions", 0),
            "totalPullRequestContributions": collection.get("totalPullRequestContributions", 0),
            "totalPullRequestReviewContributions": collection.get("totalPullRequestReviewContributions", 0),
            "restrictedContributionsCount": collection.get("restrictedContributionsCount", 0),
            "calendar": calendar.get("weeks", []),
            **streaks,
        }
        ctx.cache.set_stable(cache_key, result)
        return result


class RepositoriesCollector(Collector):
    """Collect repository metadata with pagination."""

    name = "repositories"
    template_refs = {"repositories", "repos", "github"}
    optional = True

    def collect(self, ctx: CollectorContext) -> list[dict[str, Any]]:
        client = GitHubClient(ctx.config.github)
        username = ctx.config.github.username
        all_repos: list[dict] = []
        after = None

        try:
            while True:
                variables = {"login": username, "first": 50}
                if after:
                    variables["after"] = after

                data = client.graphql_query(REPOS_QUERY, variables=variables)
                repos_data = data.get("user", {}).get("repositories", {})
                nodes = repos_data.get("nodes", [])

                for node in nodes:
                    languages = []
                    for edge in node.get("languages", {}).get("edges", []):
                        languages.append({
                            "name": edge.get("node", {}).get("name"),
                            "color": edge.get("node", {}).get("color"),
                            "size": edge.get("size", 0),
                        })

                    topics = [
                        t.get("topic", {}).get("name")
                        for t in node.get("repositoryTopics", {}).get("nodes", [])
                    ]

                    all_repos.append({
                        "id": node.get("id"),
                        "name": node.get("name"),
                        "full_name": node.get("nameWithOwner"),
                        "description": node.get("description"),
                        "url": node.get("url"),
                        "homepage": node.get("homepageUrl"),
                        "is_private": node.get("isPrivate", False),
                        "is_fork": node.get("isFork", False),
                        "is_archived": node.get("isArchived", False),
                        "stars": node.get("stargazerCount", 0),
                        "forks": node.get("forkCount", 0),
                        "primary_language": (node.get("primaryLanguage") or {}).get("name"),
                        "primary_language_color": (node.get("primaryLanguage") or {}).get("color"),
                        "languages": languages,
                        "topics": topics,
                        "default_branch": (node.get("defaultBranchRef") or {}).get("name"),
                        "created_at": node.get("createdAt"),
                        "pushed_at": node.get("pushedAt"),
                    })

                page_info = repos_data.get("pageInfo", {})
                if not page_info.get("hasNextPage"):
                    break
                after = page_info.get("endCursor")

                if len(all_repos) >= 200:
                    break
        finally:
            client.close()

        return all_repos
