import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

const MULTI_YEAR_CONTRIBUTIONS_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            color
          }
        }
      }
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
    }
  }
}
`;

export const multiYearContributionsCollector: Collector = {
  name: "multi_year_contributions",
  templateRefs: new Set(["computedStats", "stats", "yearOverYearGrowth", "contributionsLastYear"]),
  dependencies: new Set(),
  optional: true,

  collect(ctx: CollectorContext): Promise<Record<string, unknown>> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `graphql_contributions_last_year:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return Promise.resolve(cached as Record<string, unknown>);

    const now = new Date();
    const lastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const lastYearEnd = new Date(lastYearStart.getTime() + 365 * 24 * 60 * 60 * 1000);

    const client = new GitHubClient(ctx.config.github);
    return client
      .graphqlQuery(MULTI_YEAR_CONTRIBUTIONS_QUERY, {
        login: username,
        from: lastYearStart.toISOString(),
        to: lastYearEnd.toISOString(),
      })
      .then((data) => {
        const collection = ((data as { user?: { contributionsCollection?: Record<string, unknown> } }).user?.contributionsCollection) ?? {};
        const calendar = (collection.contributionCalendar as { totalContributions?: number; weeks?: unknown[] }) ?? {};

        const result = {
          lastYearContributions: calendar.totalContributions ?? 0,
          lastYearCalendar: calendar.weeks ?? [],
          lastYearCommitContributions: (collection.totalCommitContributions as number) ?? 0,
          lastYearIssueContributions: (collection.totalIssueContributions as number) ?? 0,
          lastYearPullRequestContributions: (collection.totalPullRequestContributions as number) ?? 0,
        };
        ctx.cache.setStable(cacheKey, result);
        return result;
      });
  },
};
