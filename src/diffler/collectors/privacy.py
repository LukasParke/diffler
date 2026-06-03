"""Privacy redaction for public-safe output.

Mirrors stats-action's privacy model: aggregate private data can appear,
but identifying details (names, URLs, descriptions, topics) are redacted.
"""

from __future__ import annotations

from typing import Any


class PrivacyGuard:
    """Redacts private repository details from collected data."""

    def __init__(self, include_private: bool = False) -> None:
        self.include_private = include_private
        self.redaction_count: int = 0

    def redact_repo(self, repo: dict[str, Any]) -> dict[str, Any]:
        """Redact a repository dict if it is private."""
        if self.include_private or not repo.get("isPrivate", False):
            return repo

        self.redaction_count += 1
        return {
            **repo,
            "name": "[REDACTED]",
            "full_name": "[REDACTED]",
            "description": None,
            "url": None,
            "homepageUrl": None,
            "topics": [],
            "defaultBranch": None,
        }

    def redact_repos(self, repos: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Redact a list of repository dicts."""
        return [self.redact_repo(r) for r in repos]

    def apply_to_stats(self, stats: dict[str, Any]) -> dict[str, Any]:
        """Apply redaction to a full stats output dict."""
        if self.include_private:
            return stats

        if "repositories" in stats:
            stats["repositories"] = self.redact_repos(stats["repositories"])
        if "topRepos" in stats:
            stats["topRepos"] = self.redact_repos(stats["topRepos"])
        if "repoMetrics" in stats and "traffic" in stats["repoMetrics"]:
            stats["repoMetrics"]["traffic"] = {
                k: [
                    {**t, "repo": "[REDACTED]" if t.get("isPrivate") else t.get("repo", "")}
                    for t in v
                ]
                for k, v in stats["repoMetrics"]["traffic"].items()
            }

        stats["privacy"] = {
            "includePrivateDetails": False,
            "redactedEntries": self.redaction_count,
        }
        return stats
