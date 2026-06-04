import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

const REPO_CONTRIBUTIONS_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository {
          nameWithOwner
          id
        }
        contributions {
          totalCount
        }
      }
    }
  }
}
`;

export const repoContributionsCollector: Collector = {
  name: "repo_contributions",
  templateRefs: new Set(["repo_contributions", "repositories"]),
  dependencies: new Set(),
  optional: true,

  collect(ctx: CollectorContext): Promise<Record<string, Record<string, number>>> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `graphql_repo_contributions:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return Promise.resolve(cached as Record<string, Record<string, number>>);

    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const client = new GitHubClient(ctx.config.github);
    return client
      .graphqlQuery(REPO_CONTRIBUTIONS_QUERY, {
        login: username,
        from: oneYearAgo.toISOString(),
        to: now.toISOString(),
      })
      .then((data) => {
        const collection = ((data as { user?: { contributionsCollection?: Record<string, unknown> } }).user?.contributionsCollection) ?? {};
        const byRepo = (collection.commitContributionsByRepository as Record<string, unknown>[]) ?? [];

        const result: Record<string, Record<string, number>> = {};
        for (const entry of byRepo) {
          const repo = (entry.repository as { nameWithOwner?: string }) ?? {};
          const contributions = (entry.contributions as { totalCount?: number }) ?? {};
          const fullName = repo.nameWithOwner;
          if (fullName) {
            result[fullName] = { commits: contributions.totalCount ?? 0 };
          }
        }

        ctx.cache.setStable(cacheKey, result);
        return result;
      });
  },
};
