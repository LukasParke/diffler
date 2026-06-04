import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

export const organizationsCollector: Collector = {
  name: "organizations",
  templateRefs: new Set(["organizations", "orgs", "github"]),
  dependencies: new Set(),
  optional: true,

  async collect(ctx: CollectorContext): Promise<Record<string, unknown>[]> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `rest_orgs:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return cached as Record<string, unknown>[];

    const client = new GitHubClient(ctx.config.github);
    const orgs: Record<string, unknown>[] = [];
    let page = 1;

    while (true) {
      const data = (await client.restGet(`/users/${username}/orgs`, {
        per_page: 100,
        page,
      })) as Record<string, unknown>[];

      if (!Array.isArray(data) || data.length === 0) break;

      for (const org of data) {
        orgs.push({
          login: org.login ?? "",
          id: org.id ?? null,
          url: org.url ?? "",
          avatar_url: org.avatar_url ?? "",
          description: org.description ?? null,
        });
      }

      if (data.length < 100) break;
      page++;
      if (page > 10) break;
    }

    ctx.cache.setStable(cacheKey, orgs);
    return orgs;
  },
};
