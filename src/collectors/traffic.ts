import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

export const trafficCollector: Collector = {
  name: "traffic",
  templateRefs: new Set(["traffic", "repoMetrics"]),
  dependencies: new Set(["repositories"]),
  optional: true,

  async collect(ctx: CollectorContext): Promise<Record<string, unknown>> {
    const username = ctx.config.github.username;
    const repos = (ctx.get("repositories") as Record<string, unknown>[]) ?? [];

    const cacheKey = `rest_traffic:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return cached as Record<string, unknown>;

    const client = new GitHubClient(ctx.config.github);
    const viewsData: Record<string, unknown>[] = [];
    const clonesData: Record<string, unknown>[] = [];

    for (const repo of repos.slice(0, 20)) {
      if (repo.is_fork || repo.is_archived) continue;
      const fullName = repo.full_name as string;
      if (!fullName) continue;

      try {
        const views = (await client.restGet(`/repos/${fullName}/traffic/views`)) as Record<string, unknown>;
        if (typeof views === "object" && views !== null) {
          viewsData.push({
            repo: repo.name,
            full_name: fullName,
            count: views.count ?? 0,
            uniques: views.uniques ?? 0,
          });
        }

        const clones = (await client.restGet(`/repos/${fullName}/traffic/clones`)) as Record<string, unknown>;
        if (typeof clones === "object" && clones !== null) {
          clonesData.push({
            repo: repo.name,
            full_name: fullName,
            count: clones.count ?? 0,
            uniques: clones.uniques ?? 0,
          });
        }
      } catch {
        // No traffic access
      }
    }

    const result = { views: viewsData, clones: clonesData };
    ctx.cache.setStable(cacheKey, result);
    return result;
  },
};
