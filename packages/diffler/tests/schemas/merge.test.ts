import { describe, it, expect } from "vitest";
import {
  mergeContributionCalendars,
  mergeStatsOutputs,
  type GitHubStatsOutput,
} from "@lukasparke/diffler-schemas";

function week(days: Array<[string, number]>): {
  totalContributions: number;
  weeks: Array<{ contributionDays: Array<{ date: string; contributionCount: number }> }>;
} {
  return {
    totalContributions: days.reduce((sum, [, count]) => sum + count, 0),
    weeks: [
      {
        contributionDays: days.map(([date, contributionCount]) => ({
          date,
          contributionCount,
        })),
      },
    ],
  };
}

// 2026-06-01 is a Monday; weeks are anchored on Sunday.
function calendarFixture() {
  return week([
    ["2026-05-31", 1],
    ["2026-06-01", 2],
    ["2026-06-02", 3],
  ]);
}

export function buildOutputFixture(overrides: {
  login: string;
  totalContributions: number;
  stars: number;
  calendar?: ReturnType<typeof calendarFixture>;
}): GitHubStatsOutput {
  const calendar = overrides.calendar ?? calendarFixture();
  const repo = {
    id: `R_${overrides.login}`,
    name: "repo",
    nameWithOwner: `${overrides.login}/repo`,
    owner: overrides.login,
    ownerType: "User",
    description: null,
    url: null,
    isArchived: false,
    isFork: false,
    isPrivate: false,
    visibility: "PUBLIC",
    viewerPermission: "ADMIN",
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    pushedAt: "2026-01-01T00:00:00.000Z",
    defaultBranchOid: "abc",
    stars: overrides.stars,
    forks: 1,
    primaryLanguage: "TypeScript",
    topics: [],
    languages: [
      { languageName: "TypeScript", color: "#3178c6", value: 1000, percentage: 100 },
    ],
    codeByteTotal: 1000,
    sources: ["owned"] as GitHubStatsOutput["repositories"][number]["sources"],
    contributionCounts: {
      commits: 1,
      issues: 0,
      pullRequests: 0,
      pullRequestReviews: 0,
      repositoryCreations: 0,
    },
    metadataFetchedAt: 1,
  };

  const profileMetrics = {
    totalRepos: 1,
    publicRepos: 1,
    privateRepos: 0,
    originalRepos: 1,
    forkedRepos: 0,
    activeOriginalRepos: 1,
    archivedOriginalRepos: 0,
    reposWithStars: 1,
    starsReceived: overrides.stars,
    forksReceived: 1,
    codeByteTotal: 1000,
    topLanguages: repo.languages,
  };

  const repoMetrics = {
    starCount: overrides.stars,
    forkCount: 1,
    codeByteTotal: 1000,
    topLanguages: repo.languages,
    topTopics: [],
    profile: profileMetrics,
    contributorStats: {
      totalCommits: 10,
      linesAdded: 5,
      linesDeleted: 2,
      linesOfCodeChanged: 7,
      reposCompleted: 1,
      reposPending: 0,
      reposFailed: 0,
    },
    traffic: {
      repoViews: 4,
      repoViewUniques: 2,
      reposCompleted: 1,
      reposPending: 0,
      reposFailed: 0,
    },
    repoStats: {
      totalRepos: 1,
      publicRepos: 1,
      privateRepos: 0,
      archivedRepos: 0,
      forkedRepos: 0,
      originalRepos: 1,
      activeRepos: 1,
      reposWithStars: 1,
      reposCreatedThisYear: 0,
      averageStarsPerRepo: overrides.stars,
    },
    computedStats: {
      totalRepos: 1,
      publicRepos: 1,
      privateRepos: 0,
      archivedRepos: 0,
      forkedRepos: 0,
      originalRepos: 1,
      activeRepos: 1,
      reposWithStars: 1,
      reposCreatedThisYear: 0,
      averageStarsPerRepo: overrides.stars,
      languageCount: 1,
      primaryLanguage: "TypeScript",
      primaryLanguageThisYear: "TypeScript",
      topLanguagesThisYear: repo.languages,
      totalTopics: 0,
      topTopics: [],
      allTopics: [],
      contributionsThisYear: overrides.totalContributions,
      contributionsLastYear: 0,
      yearOverYearGrowth: null,
      mostProductiveMonth: null,
    },
  };

  return {
    schemaVersion: 2,
    generatedAt: "2026-08-14T00:00:00.000Z",
    profile: {
      name: overrides.login,
      login: overrides.login,
      bio: null,
      company: null,
      location: null,
      email: null,
      twitterUsername: null,
      websiteUrl: null,
      avatarUrl: `https://github.com/${overrides.login}.png`,
      createdAt: "2020-01-01T00:00:00.000Z",
      followers: 1,
      following: 1,
    },
    profileContributions: {
      totalContributions: overrides.totalContributions,
      totalCommitContributions: overrides.totalContributions,
      restrictedContributionsCount: 0,
      totalIssueContributions: 0,
      totalRepositoryContributions: 0,
      totalPullRequestContributions: 0,
      totalPullRequestReviewContributions: 0,
      contributionCalendar: calendar,
      stats: {
        longestStreak: 3,
        currentStreak: 3,
        mostActiveDay: "Monday",
        averagePerDay: 2,
        averagePerWeek: 14,
        averagePerMonth: 60,
        monthlyBreakdown: [],
        yearlyBreakdown: [{ year: "2026", contributions: overrides.totalContributions }],
        peakDay: { date: "2026-06-02", contributions: 3 },
      },
      repositoryContributions: [],
      completeness: {
        complete: true,
        yearsFetched: ["2026"],
        yearsFromCache: [],
        missingYears: [],
      },
    },
    activity: {
      totalPullRequests: 1,
      openIssues: 1,
      closedIssues: 1,
      repositoriesContributedTo: 1,
      discussionsStarted: 0,
      discussionsAnswered: 0,
      starsGiven: 1,
    },
    repositories: [repo],
    repoMetrics,
    packageMetrics: {
      packageCount: 0,
      providers: [],
      downloads: { lastDay: 0, lastWeek: 0, lastMonth: 0, lastYear: 0, allTime: 0 },
      packages: [],
      complete: true,
      warnings: [],
    },
    presentation: {
      readmeSummary: {
        name: overrides.login,
        username: overrides.login,
        totalContributions: overrides.totalContributions,
        currentStreak: 3,
        longestStreak: 3,
        topLanguages: repo.languages.slice(0, 5),
        starsReceived: overrides.stars,
        forksReceived: 1,
        totalRepos: 1,
        originalRepos: 1,
        activeRepos: 1,
        languageCount: 1,
        codeByteTotal: 1000,
        refreshedAt: "2026-08-14T00:00:00.000Z",
        complete: true,
      },
      cards: [],
      timeline: [{ period: "2026", contributions: overrides.totalContributions }],
      highlights: [],
      remotion: { scenes: [] },
    },
    privacy: {
      privateRepositoryMetricsIncluded: false,
      privateRepositoryDetailsIncluded: false,
      privateCacheDetailsIncluded: false,
      redactedPrivateRepositories: 0,
      redactedRepositoryContributions: 0,
      redactedOptionalMetrics: 0,
    },
    collectionStatus: {
      startedAt: 1,
      finishedAt: 2,
      durationMs: 1,
      complete: true,
      coreComplete: true,
      cache: {
        stablePath: ".diffler/cache-stable.json",
        volatilePath: ".diffler/cache-volatile.json",
        contributionYearsFromCache: 0,
        contributionYearsFetched: 1,
        repositoriesFromCache: 0,
        repositoriesFetched: 1,
      },
      backfill: {
        enabled: true,
        completedThisRun: 1,
        pending: 0,
        failedThisRun: 0,
        skippedThisRun: 0,
      },
      rateLimit: { graphql: null, rest: null },
      warnings: [],
      errors: [],
    },
  };
}

describe("mergeContributionCalendars", () => {
  it("sums per-day counts and keeps weeks anchored on Sunday", () => {
    const merged = mergeContributionCalendars([calendarFixture(), calendarFixture()]);

    expect(merged.totalContributions).toBe(12);
    const days = merged.weeks.flatMap((w) => w.contributionDays);
    expect(days).toHaveLength(3);
    expect(days[0]).toEqual({ date: "2026-05-31", contributionCount: 2 });
    expect(days[2]).toEqual({ date: "2026-06-02", contributionCount: 6 });
    // 2026-05-31 is a Sunday and starts the week; Mon/Tue continue it.
    expect(merged.weeks).toHaveLength(1);
    expect(merged.weeks[0].contributionDays.map((d) => d.date)).toEqual([
      "2026-05-31",
      "2026-06-01",
      "2026-06-02",
    ]);
  });

  it("starts a new week at each Sunday", () => {
    const merged = mergeContributionCalendars([
      week([
        ["2026-05-30", 1],
        ["2026-05-31", 2],
        ["2026-06-01", 3],
      ]),
    ]);

    // 2026-05-30 is a Saturday, 2026-05-31 the next Sunday.
    expect(merged.weeks).toHaveLength(2);
    expect(merged.weeks[0].contributionDays.map((d) => d.date)).toEqual(["2026-05-30"]);
    expect(merged.weeks[1].contributionDays.map((d) => d.date)).toEqual([
      "2026-05-31",
      "2026-06-01",
    ]);
  });
});

describe("mergeStatsOutputs", () => {
  it("merges totals and keeps the calendar consistent with them", () => {
    const a = buildOutputFixture({ login: "alice", totalContributions: 6, stars: 10 });
    const b = buildOutputFixture({ login: "bob", totalContributions: 4, stars: 5 });

    const merged = mergeStatsOutputs([a, b]);

    expect(merged.profileContributions.totalContributions).toBe(12); // 6 + 4 calendar days summed
    expect(merged.profileContributions.contributionCalendar.totalContributions).toBe(
      merged.profileContributions.totalContributions
    );
    expect(merged.activity.totalPullRequests).toBe(2);
    expect(merged.activity.starsGiven).toBe(2);
    expect(merged.repositories).toHaveLength(2);
    expect(merged.repoMetrics.starCount).toBe(15);
    expect(merged.repoMetrics.contributorStats.totalCommits).toBe(20);
    expect(merged.repoMetrics.traffic.repoViews).toBe(8);
    expect(merged.packageMetrics.packageCount).toBe(0);
    expect(merged.presentation.readmeSummary.totalContributions).toBe(
      merged.profileContributions.totalContributions
    );
  });

  it("dedupes repositories shared by profiles and sums their contribution counts", () => {
    const a = buildOutputFixture({ login: "alice", totalContributions: 6, stars: 10 });
    const b = buildOutputFixture({ login: "bob", totalContributions: 4, stars: 5 });
    const shared = { ...a.repositories[0], id: "R_shared", nameWithOwner: "org/shared", owner: "org" };
    a.repositories.push(shared);
    b.repositories.push({ ...shared, contributionCounts: { ...shared.contributionCounts, commits: 4 } });

    const merged = mergeStatsOutputs([a, b]);

    const sharedMerged = merged.repositories.find((repo) => repo.id === "R_shared");
    expect(merged.repositories).toHaveLength(3);
    expect(sharedMerged?.contributionCounts.commits).toBe(5);
    expect(sharedMerged?.sources).toEqual(["owned"]);
  });

  it("returns the single output unchanged", () => {
    const a = buildOutputFixture({ login: "alice", totalContributions: 6, stars: 10 });
    expect(mergeStatsOutputs([a])).toBe(a);
  });
});
