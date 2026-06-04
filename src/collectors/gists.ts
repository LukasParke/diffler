import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

export const gistsCollector: Collector = {
  name: "gists",
  templateRefs: new Set(["gists", "github"]),
  dependencies: new Set(),
  optional: true,

  async collect(ctx: CollectorContext): Promise<Record<string, unknown>[]> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `rest_gists:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return cached as Record<string, unknown>[];

    const client = new GitHubClient(ctx.config.github);
    const allGists: Record<string, unknown>[] = [];
    let page = 1;

    while (true) {
      const data = (await client.restGet(`/users/${username}/gists`, {
        per_page: 100,
        page,
      })) as Record<string, unknown>[];

      if (!Array.isArray(data) || data.length === 0) break;

      for (const gist of data) {
        allGists.push({
          id: gist.id ?? "",
          description: gist.description ?? null,
          html_url: gist.html_url ?? "",
          public: gist.public ?? true,
          created_at: gist.created_at ?? null,
          updated_at: gist.updated_at ?? null,
          files: Object.keys((gist.files as Record<string, unknown>) ?? {}),
        });
      }

      if (data.length < 100) break;
      page++;
      if (page > 10) break;
    }

    ctx.cache.setStable(cacheKey, allGists);
    return allGists;
  },
};
