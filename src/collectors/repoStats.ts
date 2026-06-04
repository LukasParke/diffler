import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

function parseTimestamp(iso: string): number {
  try {
    return new Date(iso).getTime();
  } catch {
    return 0;
  }
}

export const repoStatsCollector: Collector = {
  name: "repo_stats",
  templateRefs: new Set(["repoStats", "repositories", "stats"]),
  dependencies: new Set(["repositories"]),
  optional: true,

  collect(ctx: CollectorContext): Record<string, unknown> {
    const repos = (ctx.get("repositories") as Record<string, unknown>[]) ?? [];
    if (repos.length === 0) return {};

    const now = Date.now();
    const currentYear = new Date().getFullYear();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    const total = repos.length;
    const publicRepos = repos.filter((r) => r.visibility === "PUBLIC" || !r.is_private);
    const privateRepos = repos.filter((r) => r.is_private);
    const archived = repos.filter((r) => r.is_archived);
    const forked = repos.filter((r) => r.is_fork);
    const original = repos.filter((r) => !r.is_fork);
    const withStars = repos.filter((r) => (r.stars as number) > 0);
    const createdThisYear = repos.filter((r) => {
      const year = new Date(r.created_at as string).getFullYear();
      return year === currentYear;
    });
    const active = repos.filter((r) => {
      const ts = parseTimestamp(r.pushed_at as string);
      return ts > ninetyDaysAgo;
    });
    const totalStars = repos.reduce((a, r) => a + ((r.stars as number) ?? 0), 0);

    return {
      totalRepos: total,
      publicRepos: publicRepos.length,
      privateRepos: privateRepos.length,
      archivedRepos: archived.length,
      forkedRepos: forked.length,
      originalRepos: original.length,
      activeRepos: active.length,
      reposWithStars: withStars.length,
      reposCreatedThisYear: createdThisYear.length,
      averageStarsPerRepo: total > 0 ? Math.round((totalStars / total) * 10) / 10 : 0,
    };
  },
};
