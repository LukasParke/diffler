"""GitHub GraphQL queries and response parsing."""

from __future__ import annotations

from typing import Any

USER_PROFILE_QUERY = """
query($login: String!) {
  user(login: $login) {
    login
    name
    bio
    company
    location
    websiteUrl
    twitterUsername
    followers {
      totalCount
    }
    following {
      totalCount
    }
    repositories(privacy: PUBLIC, first: 100, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes {
        name
        nameWithOwner
        description
        url
        stargazerCount
        forkCount
        primaryLanguage {
          name
          color
        }
        isFork
        isArchived
        createdAt
        updatedAt
      }
    }
    contributionsCollection {
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
    }
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name
          nameWithOwner
          description
          url
          stargazerCount
          forkCount
          primaryLanguage {
            name
            color
          }
        }
      }
    }
  }
}
"""


def parse_user(data: dict[str, Any]) -> dict[str, Any]:
    """Parse GraphQL user response into a flat, template-friendly dict."""
    user = data.get("user") or {}
    repos = user.get("repositories", {}).get("nodes", [])
    pinned = user.get("pinnedItems", {}).get("nodes", [])
    contrib = user.get("contributionsCollection", {})
    calendar = contrib.get("contributionCalendar", {})

    return {
        "login": user.get("login"),
        "name": user.get("name") or user.get("login"),
        "bio": user.get("bio"),
        "company": user.get("company"),
        "location": user.get("location"),
        "website_url": user.get("websiteUrl"),
        "twitter_username": user.get("twitterUsername"),
        "followers": user.get("followers", {}).get("totalCount", 0),
        "following": user.get("following", {}).get("totalCount", 0),
        "public_repos": user.get("repositories", {}).get("totalCount", 0),
        "repositories": [
            {
                "name": r.get("name"),
                "full_name": r.get("nameWithOwner"),
                "description": r.get("description"),
                "url": r.get("url"),
                "stars": r.get("stargazerCount", 0),
                "forks": r.get("forkCount", 0),
                "language": (r.get("primaryLanguage") or {}).get("name"),
                "language_color": (r.get("primaryLanguage") or {}).get("color"),
                "is_fork": r.get("isFork", False),
                "is_archived": r.get("isArchived", False),
            }
            for r in repos
        ],
        "pinned_repositories": [
            {
                "name": r.get("name"),
                "full_name": r.get("nameWithOwner"),
                "description": r.get("description"),
                "url": r.get("url"),
                "stars": r.get("stargazerCount", 0),
                "forks": r.get("forkCount", 0),
                "language": (r.get("primaryLanguage") or {}).get("name"),
                "language_color": (r.get("primaryLanguage") or {}).get("color"),
            }
            for r in pinned
        ],
        "contributions": {
            "total": calendar.get("totalContributions", 0),
            "commits": contrib.get("totalCommitContributions", 0),
            "issues": contrib.get("totalIssueContributions", 0),
            "pull_requests": contrib.get("totalPullRequestContributions", 0),
            "reviews": contrib.get("totalPullRequestReviewContributions", 0),
            "calendar": calendar.get("weeks", []),
        },
    }
