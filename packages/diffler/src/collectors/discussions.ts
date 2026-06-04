import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

const DISCUSSIONS_QUERY = `
query($login: String!) {
  user(login: $login) {
    repositoryDiscussions(first: 1) {
      totalCount
    }
  }
}
`;

export const discussionsCollector: Collector = {
  name: "discussions",
  templateRefs: new Set(["discussionsStarted", "discussionsAnswered", "activity"]),
  dependencies: new Set(),
  optional: true,

  collect(ctx: CollectorContext): Promise<Record<string, unknown>> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `graphql_discussions:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return Promise.resolve(cached as Record<string, unknown>);

    const client = new GitHubClient(ctx.config.github);
    return client
      .graphqlQuery(DISCUSSIONS_QUERY, { login: username })
      .then((data) => {
        const user = (data as { user?: Record<string, unknown> }).user ?? {};
        const result = {
          discussionsStarted: ((user.repositoryDiscussions as { totalCount?: number })?.totalCount) ?? 0,
          discussionsAnswered: 0,
        };
        ctx.cache.setStable(cacheKey, result);
        return result;
      });
  },
};
