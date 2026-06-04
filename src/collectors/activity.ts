import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

const ACTIVITY_QUERY = `
query($login: String!) {
  user(login: $login) {
    pullRequests(first: 1) {
      totalCount
    }
    issues(first: 1) {
      totalCount
    }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
      totalCount
    }
    starredRepositories(first: 1) {
      totalCount
    }
  }
}
`;

export const activityCollector: Collector = {
  name: "activity",
  templateRefs: new Set([
    "activity",
    "totalPullRequests",
    "openIssues",
    "closedIssues",
    "repositoriesContributedTo",
    "starsGiven",
  ]),
  dependencies: new Set(),
  optional: true,

  async collect(ctx: CollectorContext): Promise<Record<string, unknown>> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `graphql_activity:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return cached as Record<string, unknown>;

    const client = new GitHubClient(ctx.config.github);
    const data = await client.graphqlQuery(ACTIVITY_QUERY, { login: username });
    const user = (data as { user?: Record<string, unknown> }).user ?? {};

    const [openIssues, closedIssues] = await fetchIssueCounts(ctx);

    const result = {
      totalPullRequests: ((user.pullRequests as { totalCount?: number })?.totalCount) ?? 0,
      openIssues,
      closedIssues,
      repositoriesContributedTo: ((user.repositoriesContributedTo as { totalCount?: number })?.totalCount) ?? 0,
      starsGiven: ((user.starredRepositories as { totalCount?: number })?.totalCount) ?? 0,
    };
    ctx.cache.setStable(cacheKey, result);
    return result;
  },
};

async function fetchIssueCounts(ctx: CollectorContext): Promise<[number, number]> {
  const username = ctx.config.github.username;
  if (!username) return [0, 0];

  const client = new GitHubClient(ctx.config.github);
  try {
    const openData = (await client.restGet("/search/issues", {
      q: `author:${username} type:issue state:open`,
      per_page: 1,
    })) as { total_count?: number };
    const closedData = (await client.restGet("/search/issues", {
      q: `author:${username} type:issue state:closed`,
      per_page: 1,
    })) as { total_count?: number };
    return [openData.total_count ?? 0, closedData.total_count ?? 0];
  } catch {
    return [0, 0];
  }
}
