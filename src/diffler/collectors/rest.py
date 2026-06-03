"""REST-based data collectors and backfill logic.

REST is more reliable than GraphQL for large repository lists and
supports endpoints GraphQL doesn't (traffic, contributor stats).
"""

from __future__ import annotations

import logging
from typing import Any

from diffler.collectors.base import Collector, CollectorContext
from diffler.github.client import GitHubClient

logger = logging.getLogger(__name__)


class RepositoriesRestCollector(Collector):
    """Collect repository metadata via REST API.

    Uses REST for the repository list (more reliable than GraphQL for
    users with many repos) and fetches languages separately.
    """

    name = "repositories"
    template_refs = {"repositories", "repos", "github"}
    optional = True

    def collect(self, ctx: CollectorContext) -> list[dict[str, Any]]:
        username = ctx.config.github.username
        cache_key = f"rest_repos:{username}"

        # Check cache first
        cached = ctx.cache.get(cache_key)
        if cached:
            logger.info("Using cached repository list (%d repos)", len(cached))
            return cached

        client = GitHubClient(ctx.config.github)
        all_repos: list[dict] = []

        try:
            # 1. User repos
            page = 1
            while True:
                data = client.rest_get(
                    f"/users/{username}/repos",
                    params={
                        "per_page": 100,
                        "page": page,
                        "sort": "pushed",
                        "direction": "desc",
                    },
                )
                if not isinstance(data, list) or not data:
                    break

                for repo in data:
                    all_repos.append(self._normalize_repo(repo))

                if len(data) < 100:
                    break
                page += 1
                if page > 10:  # Safety: max 1000 repos
                    break

            # 2. Organization repos (if enabled)
            if ctx.config.github.include_orgs:
                orgs = ctx.get("organizations", [])
                if not orgs:
                    # Try to fetch orgs inline if collector hasn't run
                    orgs = self._fetch_orgs(ctx, client)
                for org in orgs:
                    org_login = org.get("login", "")
                    if not org_login:
                        continue
                    try:
                        org_page = 1
                        while True:
                            org_data = client.rest_get(
                                f"/orgs/{org_login}/repos",
                                params={
                                    "per_page": 100,
                                    "page": org_page,
                                    "sort": "pushed",
                                    "direction": "desc",
                                },
                            )
                            if not isinstance(org_data, list) or not org_data:
                                break
                            for repo in org_data:
                                normalized = self._normalize_repo(repo)
                                normalized["org"] = org_login
                                all_repos.append(normalized)
                            if len(org_data) < 100:
                                break
                            org_page += 1
                            if org_page > 10:
                                break
                    except Exception:
                        logger.debug("Failed to fetch org repos for %s", org_login)

            # 3. Fetch languages for top repos (optional, rate-limit aware)
            self._enrich_languages(ctx, all_repos, client)
        finally:
            client.close()

        # Store in stable cache
        ctx.cache.set_stable(cache_key, all_repos)
        return all_repos

    def _fetch_orgs(self, ctx: CollectorContext, client: GitHubClient) -> list[dict]:
        """Inline org fetch when OrganizationsCollector hasn't run."""
        username = ctx.config.github.username
        orgs: list[dict] = []
        page = 1
        try:
            while True:
                data = client.rest_get(
                    f"/users/{username}/orgs",
                    params={"per_page": 100, "page": page},
                )
                if not isinstance(data, list) or not data:
                    break
                for org in data:
                    orgs.append({"login": org.get("login", "")})
                if len(data) < 100:
                    break
                page += 1
                if page > 10:
                    break
        except Exception:
            logger.debug("Failed to fetch orgs inline")
        return orgs

    def _normalize_repo(self, repo: dict[str, Any]) -> dict[str, Any]:
        """Normalize a REST repo dict to the common schema."""
        return {
            "id": repo.get("node_id", ""),
            "name": repo.get("name", ""),
            "full_name": repo.get("full_name", ""),
            "description": repo.get("description"),
            "url": repo.get("html_url", ""),
            "homepage": repo.get("homepage") or None,
            "is_private": repo.get("private", False),
            "is_fork": repo.get("fork", False),
            "is_archived": repo.get("archived", False),
            "stars": repo.get("stargazers_count", 0),
            "forks": repo.get("forks_count", 0),
            "primary_language": repo.get("language"),
            "primary_language_color": None,  # Will be enriched
            "languages": [],
            "topics": repo.get("topics", []),
            "default_branch": repo.get("default_branch"),
            "created_at": repo.get("created_at"),
            "pushed_at": repo.get("pushed_at"),
            "updated_at": repo.get("updated_at"),
            "owner": (repo.get("owner") or {}).get("login"),
            "owner_type": (repo.get("owner") or {}).get("type"),
            "visibility": repo.get("visibility"),
        }

    def _enrich_languages(
        self,
        ctx: CollectorContext,
        repos: list[dict],
        client: GitHubClient,
    ) -> None:
        """Fetch language breakdown for top repos via REST."""
        if ctx.rate_limit_remaining < 1000:
            logger.info("Skipping language enrichment (rate limit low)")
            return

        for repo in repos[:30]:
            full_name = repo.get("full_name", "")
            if not full_name:
                continue
            try:
                langs = client.rest_get(f"/repos/{full_name}/languages")
                if isinstance(langs, dict):
                    total = sum(langs.values())
                    repo["languages"] = [
                        {
                            "name": name,
                            "color": None,
                            "size": bytes_count,
                            "percentage": round((bytes_count / total) * 100, 2) if total else 0,
                        }
                        for name, bytes_count in sorted(
                            langs.items(), key=lambda x: x[1], reverse=True
                        )
                    ]
                    if repo["languages"]:
                        repo["primary_language_color"] = repo["languages"][0].get("color")
            except Exception:
                logger.debug("Failed to fetch languages for %s", full_name)


class TrafficCollector(Collector):
    """Collect repository traffic (views and clones) via REST.

    Requires push access to the repository.
    """

    name = "traffic"
    template_refs = {"traffic", "repoMetrics"}
    optional = True

    def collect(self, ctx: CollectorContext) -> dict[str, Any]:
        username = ctx.config.github.username
        repos = ctx.get("repositories", [])
        cache_key = f"rest_traffic:{username}"

        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        client = GitHubClient(ctx.config.github)
        views_data: list[dict] = []
        clones_data: list[dict] = []

        try:
            for repo in repos[:20]:  # Limit to avoid rate limits
                if repo.get("is_fork") or repo.get("is_archived"):
                    continue
                full_name = repo.get("full_name", "")
                if not full_name:
                    continue

                try:
                    views = client.rest_get(f"/repos/{full_name}/traffic/views")
                    if isinstance(views, dict):
                        views_data.append({
                            "repo": repo["name"],
                            "full_name": full_name,
                            "count": views.get("count", 0),
                            "uniques": views.get("uniques", 0),
                        })

                    clones = client.rest_get(f"/repos/{full_name}/traffic/clones")
                    if isinstance(clones, dict):
                        clones_data.append({
                            "repo": repo["name"],
                            "full_name": full_name,
                            "count": clones.get("count", 0),
                            "uniques": clones.get("uniques", 0),
                        })
                except Exception:
                    logger.debug("No traffic access for %s", full_name)
        finally:
            client.close()

        result = {"views": views_data, "clones": clones_data}
        ctx.cache.set_stable(cache_key, result)
        return result


class ContributorStatsCollector(Collector):
    """Collect contributor statistics via REST.

    Shows commits by contributor per repository.
    """

    name = "contributor_stats"
    template_refs = {"contributorStats", "repoMetrics"}
    optional = True

    def collect(self, ctx: CollectorContext) -> list[dict]:
        username = ctx.config.github.username
        repos = ctx.get("repositories", [])
        cache_key = f"rest_contributors:{username}"

        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        client = GitHubClient(ctx.config.github)
        results: list[dict] = []

        try:
            for repo in repos[:15]:
                if repo.get("is_fork"):
                    continue
                full_name = repo.get("full_name", "")
                if not full_name:
                    continue

                try:
                    stats = client.rest_get(f"/repos/{full_name}/stats/contributors")
                    if isinstance(stats, list):
                        for contributor in stats:
                            author = contributor.get("author", {})
                            weeks = contributor.get("weeks", [])
                            total_additions = sum(w.get("a", 0) for w in weeks)
                            total_deletions = sum(w.get("d", 0) for w in weeks)
                            total_commits = sum(w.get("c", 0) for w in weeks)

                            results.append({
                                "repo": repo["name"],
                                "full_name": full_name,
                                "login": author.get("login"),
                                "avatar_url": author.get("avatar_url"),
                                "additions": total_additions,
                                "deletions": total_deletions,
                                "commits": total_commits,
                            })
                except Exception:
                    logger.debug("No contributor stats for %s", full_name)
        finally:
            client.close()

        ctx.cache.set_stable(cache_key, results)
        return results


class GistsCollector(Collector):
    """Collect public gists via REST API."""

    name = "gists"
    template_refs = {"gists", "github"}
    optional = True

    def collect(self, ctx: CollectorContext) -> list[dict[str, Any]]:
        username = ctx.config.github.username
        cache_key = f"rest_gists:{username}"
        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        client = GitHubClient(ctx.config.github)
        all_gists: list[dict] = []
        page = 1

        try:
            while True:
                data = client.rest_get(
                    f"/users/{username}/gists",
                    params={"per_page": 100, "page": page},
                )
                if not isinstance(data, list) or not data:
                    break
                for gist in data:
                    all_gists.append({
                        "id": gist.get("id", ""),
                        "description": gist.get("description"),
                        "html_url": gist.get("html_url", ""),
                        "public": gist.get("public", True),
                        "created_at": gist.get("created_at"),
                        "updated_at": gist.get("updated_at"),
                        "files": list(gist.get("files", {}).keys()),
                    })
                if len(data) < 100:
                    break
                page += 1
                if page > 10:
                    break
        finally:
            client.close()

        ctx.cache.set_stable(cache_key, all_gists)
        return all_gists


class OrganizationsCollector(Collector):
    """Collect organization memberships via REST API.

    Used for large-repo-mode to enumerate repositories across
    organizations the user belongs to.
    """

    name = "organizations"
    template_refs = {"organizations", "orgs", "github"}
    optional = True

    def collect(self, ctx: CollectorContext) -> list[dict[str, Any]]:
        username = ctx.config.github.username
        cache_key = f"rest_orgs:{username}"
        cached = ctx.cache.get(cache_key)
        if cached:
            return cached

        client = GitHubClient(ctx.config.github)
        orgs: list[dict] = []
        page = 1

        try:
            while True:
                data = client.rest_get(
                    f"/users/{username}/orgs",
                    params={"per_page": 100, "page": page},
                )
                if not isinstance(data, list) or not data:
                    break
                for org in data:
                    orgs.append({
                        "login": org.get("login", ""),
                        "id": org.get("id"),
                        "url": org.get("url", ""),
                        "avatar_url": org.get("avatar_url", ""),
                        "description": org.get("description"),
                    })
                if len(data) < 100:
                    break
                page += 1
                if page > 10:
                    break
        finally:
            client.close()

        ctx.cache.set_stable(cache_key, orgs)
        return orgs
