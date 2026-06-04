import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

export const repositoriesCollector: Collector = {
  name: "repositories",
  templateRefs: new Set(["repositories", "repos", "github"]),
  dependencies: new Set(),
  optional: true,

  async collect(ctx: CollectorContext): Promise<Record<string, unknown>[]> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `rest_repos:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return cached as Record<string, unknown>[];

    const client = new GitHubClient(ctx.config.github);
    const allRepos: Record<string, unknown>[] = [];

    try {
      // 1. User repos
      let page = 1;
      while (true) {
        const data = (await client.restGet(`/users/${username}/repos`, {
          per_page: 100,
          page,
          sort: "pushed",
          direction: "desc",
        })) as Record<string, unknown>[];

        if (!Array.isArray(data) || data.length === 0) break;

        for (const repo of data) {
          allRepos.push(normalizeRepo(repo));
        }

        if (data.length < 100) break;
        page++;
        if (page > 10) break; // Safety: max 1000 repos
      }

      // 2. Organization repos (if enabled)
      if (ctx.config.github.includeOrgs) {
        const orgs = (ctx.get("organizations") as Record<string, unknown>[]) ?? [];
        for (const org of orgs) {
          const orgLogin = org.login as string;
          if (!orgLogin) continue;
          try {
            let orgPage = 1;
            while (true) {
              const orgData = (await client.restGet(`/orgs/${orgLogin}/repos`, {
                per_page: 100,
                page: orgPage,
                sort: "pushed",
                direction: "desc",
              })) as Record<string, unknown>[];

              if (!Array.isArray(orgData) || orgData.length === 0) break;

              for (const repo of orgData) {
                const normalized = normalizeRepo(repo);
                normalized.org = orgLogin;
                allRepos.push(normalized);
              }

              if (orgData.length < 100) break;
              orgPage++;
              if (orgPage > 10) break;
            }
          } catch {
            // Ignore org fetch errors
          }
        }
      }

      // 3. Enrich languages for top repos
      await enrichLanguages(ctx, allRepos, client);
    } catch {
      // Ignore errors
    }

    ctx.cache.setStable(cacheKey, allRepos);
    return allRepos;
  },
};

function normalizeRepo(repo: Record<string, unknown>): Record<string, unknown> {
  const owner = (repo.owner as Record<string, unknown>) ?? {};
  return {
    id: repo.node_id ?? "",
    name: repo.name ?? "",
    full_name: repo.full_name ?? "",
    description: repo.description ?? null,
    url: repo.html_url ?? "",
    homepage: repo.homepage ?? null,
    is_private: repo.private ?? false,
    is_fork: repo.fork ?? false,
    is_archived: repo.archived ?? false,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    primary_language: repo.language ?? null,
    primary_language_color: null,
    languages: [],
    topics: repo.topics ?? [],
    default_branch: repo.default_branch ?? null,
    created_at: repo.created_at ?? null,
    pushed_at: repo.pushed_at ?? null,
    updated_at: repo.updated_at ?? null,
    owner: owner.login ?? null,
    owner_type: owner.type ?? null,
    visibility: repo.visibility ?? null,
  };
}

async function enrichLanguages(
  ctx: CollectorContext,
  repos: Record<string, unknown>[],
  client: GitHubClient
): Promise<void> {
  if (ctx.rateLimitRemaining < 1000) return;

  for (const repo of repos.slice(0, 30)) {
    const fullName = repo.full_name as string;
    if (!fullName) continue;
    try {
      const langs = (await client.restGet(`/repos/${fullName}/languages`)) as Record<string, number>;
      if (typeof langs === "object" && langs !== null) {
        const total = Object.values(langs).reduce((a, b) => a + b, 0);
        const languages = Object.entries(langs)
          .sort((a, b) => b[1] - a[1])
          .map(([name, bytesCount]) => ({
            name,
            color: null,
            size: bytesCount,
            percentage: total > 0 ? Math.round((bytesCount / total) * 10000) / 100 : 0,
          }));
        repo.languages = languages;
        if (languages.length > 0) {
          repo.primary_language_color = (languages[0] as { color: unknown }).color;
        }
      }
    } catch {
      // Ignore language fetch errors
    }
  }
}
