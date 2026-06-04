import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

const STARS_GIVEN_QUERY = `
query($login: String!, $first: Int!, $after: String) {
  user(login: $login) {
    starredRepositories(first: $first, after: $after) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        nameWithOwner
        stargazerCount
        primaryLanguage {
          name
        }
      }
    }
  }
}
`;

export const starsGivenCollector: Collector = {
  name: "stars_given",
  templateRefs: new Set(["starsGiven", "starredRepositories", "activity"]),
  dependencies: new Set(),
  optional: true,

  async collect(ctx: CollectorContext): Promise<unknown[]> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `graphql_stars_given:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return cached as unknown[];

    const client = new GitHubClient(ctx.config.github);
    const allStars: Record<string, unknown>[] = [];
    let after: string | null = null;

    while (true) {
      const variables: Record<string, unknown> = { login: username, first: 100 };
      if (after) variables.after = after;

      const data = await client.graphqlQuery(STARS_GIVEN_QUERY, variables);
      const starsData = ((data as { user?: { starredRepositories?: Record<string, unknown> } }).user?.starredRepositories) ?? {};
      const nodes = (starsData.nodes as Record<string, unknown>[]) ?? [];

      for (const node of nodes) {
        allStars.push({
          nameWithOwner: node.nameWithOwner,
          stars: ((node.stargazerCount as number) ?? 0),
          primaryLanguage: ((node.primaryLanguage as { name?: string })?.name) ?? null,
        });
      }

      const pageInfo = (starsData.pageInfo as { hasNextPage?: boolean; endCursor?: string }) ?? {};
      if (!pageInfo.hasNextPage) break;
      after = pageInfo.endCursor ?? null;

      if (allStars.length >= 1000) break;
    }

    ctx.cache.setStable(cacheKey, allStars);
    return allStars;
  },
};
