import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

export const contributorStatsCollector: Collector = {
  name: "contributor_stats",
  templateRefs: new Set(["contributorStats", "repoMetrics"]),
  dependencies: new Set(["repositories"]),
  optional: true,

  async collect(ctx: CollectorContext): Promise<Record<string, unknown>[]> {
    const username = ctx.config.github.username;
    const repos = (ctx.get("repositories") as Record<string, unknown>[]) ?? [];

    const cacheKey = `rest_contributors:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return cached as Record<string, unknown>[];

    const client = new GitHubClient(ctx.config.github);
    const results: Record<string, unknown>[] = [];

    for (const repo of repos.slice(0, 15)) {
      if (repo.is_fork) continue;
      const fullName = repo.full_name as string;
      if (!fullName) continue;

      try {
        const stats = (await client.restGet(`/repos/${fullName}/stats/contributors`)) as Record<string, unknown>[];
        if (Array.isArray(stats)) {
          for (const contributor of stats) {
            const author = (contributor.author as Record<string, unknown>) ?? {};
            const weeks = (contributor.weeks as Record<string, number>[]) ?? [];
            const totalAdditions = weeks.reduce((a, w) => a + (w.a ?? 0), 0);
            const totalDeletions = weeks.reduce((a, w) => a + (w.d ?? 0), 0);
            const totalCommits = weeks.reduce((a, w) => a + (w.c ?? 0), 0);

            results.push({
              repo: repo.name,
              full_name: fullName,
              login: author.login,
              avatar_url: author.avatar_url,
              additions: totalAdditions,
              deletions: totalDeletions,
              commits: totalCommits,
            });
          }
        }
      } catch {
        // No contributor stats
      }
    }

    ctx.cache.setStable(cacheKey, results);
    return results;
  },
};
