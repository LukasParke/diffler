import { GitHubClient } from "../github/client.js";
import { CollectorContext } from "./context.js";
import type { Collector } from "./types.js";

const CONTRIBUTIONS_QUERY = `
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

interface ContributionDay {
  date: string;
  contributionCount: number;
  color: string;
}

interface CalendarWeek {
  contributionDays: ContributionDay[];
}

function computeStreaks(weeks: CalendarWeek[]): {
  currentStreak: number;
  longestStreak: number;
  longestStreakStartDate: string;
  longestStreakEndDate: string;
} {
  const days: ContributionDay[] = [];
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      days.push(day);
    }
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let streakTemp = 0;
  let longestStart = "";
  let longestEnd = "";
  let tempStart = "";

  for (let i = 0; i < days.length; i++) {
    const day = days[days.length - 1 - i];
    const count = day.contributionCount ?? 0;
    const date = day.date ?? "";

    if (count > 0) {
      if (streakTemp === 0) tempStart = date;
      streakTemp++;
      if (i === 0) currentStreak = streakTemp;
    } else {
      if (streakTemp > longestStreak) {
        longestStreak = streakTemp;
        longestStart = tempStart;
        longestEnd = days[days.length - i]?.date ?? tempStart;
      }
      streakTemp = 0;
    }
  }

  if (streakTemp > longestStreak) {
    longestStreak = streakTemp;
    longestStart = tempStart;
    longestEnd = days[days.length - 1]?.date ?? "";
  }

  return {
    currentStreak,
    longestStreak,
    longestStreakStartDate: longestStart,
    longestStreakEndDate: longestEnd,
  };
}

export const contributionsCollector: Collector = {
  name: "contributions",
  templateRefs: new Set(["contributions", "streak", "calendar"]),
  dependencies: new Set(),
  optional: true,

  collect(ctx: CollectorContext): Promise<Record<string, unknown>> {
    const username = ctx.config.github.username;
    if (!username) throw new Error("No username configured");

    const cacheKey = `graphql_contributions:${username}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) return Promise.resolve(cached as Record<string, unknown>);

    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const client = new GitHubClient(ctx.config.github);
    return client
      .graphqlQuery(CONTRIBUTIONS_QUERY, {
        login: username,
        from: oneYearAgo.toISOString(),
        to: now.toISOString(),
      })
      .then((data) => {
        const collection = ((data as { user?: { contributionsCollection?: Record<string, unknown> } }).user?.contributionsCollection) ?? {};
        const calendar = (collection.contributionCalendar as { totalContributions?: number; weeks?: CalendarWeek[] }) ?? {};
        const streaks = computeStreaks(calendar.weeks ?? []);

        const result = {
          totalContributions: calendar.totalContributions ?? 0,
          totalCommitContributions: (collection.totalCommitContributions as number) ?? 0,
          totalIssueContributions: (collection.totalIssueContributions as number) ?? 0,
          totalPullRequestContributions: (collection.totalPullRequestContributions as number) ?? 0,
          totalPullRequestReviewContributions: (collection.totalPullRequestReviewContributions as number) ?? 0,
          restrictedContributionsCount: (collection.restrictedContributionsCount as number) ?? 0,
          calendar: calendar.weeks ?? [],
          ...streaks,
        };
        ctx.cache.setStable(cacheKey, result);
        return result;
      });
  },
};
