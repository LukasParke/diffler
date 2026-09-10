import type {
  ContributionsCollection,
  GitHubStatsOutput,
  LegacyStats,
  RepoMetrics,
  RepositoryRecord,
} from "../src/index.js";
import { emptyPackageMetrics } from "../src/index.js";

export const generatedAt = "2024-01-04T12:00:00.000Z";
export const fetchedAt = Date.parse(generatedAt);

export function createContributionsCollection(): ContributionsCollection {
  return {
    totalCommitContributions: 9,
    restrictedContributionsCount: 1,
    totalIssueContributions: 1,
    totalRepositoryContributions: 0,
    totalPullRequestContributions: 1,
    totalPullRequestReviewContributions: 1,
    contributionCalendar: {
      totalContributions: 12,
      weeks: [
        {
          contributionDays: [
            { date: "2024-01-01", contributionCount: 4 },
            { date: "2024-01-02", contributionCount: 0 },
            { date: "2024-01-03", contributionCount: 5 },
            { date: "2024-01-04", contributionCount: 3 },
          ],
        },
      ],
    },
  };
}

export function createMinimalV2(): Pick<
  GitHubStatsOutput,
  "schemaVersion" | "generatedAt" | "profile" | "profileContributions"
> {
  return {
    schemaVersion: 2,
    generatedAt,
    profile: {
      name: "Octo Cat",
      login: "octocat",
      bio: null,
      company: null,
      location: "Earth",
      email: null,
      twitterUsername: null,
      websiteUrl: null,
      avatarUrl: "https://example.com/avatar.png",
      createdAt: "2020-01-01T00:00:00Z",
      followers: 2,
      following: 3,
    },
    profileContributions: {
      ...createContributionsCollection(),
      totalContributions: 12,
      stats: {
        longestStreak: 2,
        currentStreak: 2,
        mostActiveDay: "Wednesday",
        averagePerDay: 3,
        averagePerWeek: 21,
        averagePerMonth: 90,
        monthlyBreakdown: [{ month: "2024-01", contributions: 12 }],
        yearlyBreakdown: [{ year: "2024", contributions: 12 }],
        peakDay: { date: "2024-01-03", contributions: 5 },
      },
      repositoryContributions: [],
      completeness: {
        complete: true,
        yearsFetched: ["2024"],
        yearsFromCache: [],
        missingYears: [],
      },
    },
  };
}

export function createRepository(): RepositoryRecord {
  return {
    id: "R_PUBLIC",
    name: "hello",
    nameWithOwner: "octocat/hello",
    owner: "octocat",
    ownerType: "User",
    description: null,
    url: "https://github.com/octocat/hello",
    isArchived: false,
    isFork: false,
    isPrivate: false,
    visibility: "PUBLIC",
    viewerPermission: "ADMIN",
    createdAt: "2020-01-01T00:00:00Z",
    updatedAt: generatedAt,
    pushedAt: generatedAt,
    defaultBranchOid: "abc123",
    stars: 7,
    forks: 2,
    primaryLanguage: "TypeScript",
    topics: [],
    languages: [
      {
        languageName: "TypeScript",
        color: "#3178c6",
        value: 40,
        percentage: 40,
      },
      {
        languageName: "JavaScript",
        color: "#f1e05a",
        value: 20,
        percentage: 20,
      },
      { languageName: "Go", color: null, value: 10, percentage: 10 },
      { languageName: "Rust", color: null, value: 10, percentage: 10 },
      { languageName: "Python", color: null, value: 10, percentage: 10 },
      { languageName: "C", color: null, value: 10, percentage: 10 },
    ],
    codeByteTotal: 100,
    sources: ["owned"],
    contributionCounts: {
      commits: 2,
      issues: 0,
      pullRequests: 0,
      pullRequestReviews: 0,
      repositoryCreations: 0,
    },
    metadataFetchedAt: fetchedAt,
  };
}

/** Historical full v2 export with aliases: one repository and four calendar days. */
export function createFullV2(): GitHubStatsOutput & LegacyStats & { legacy: LegacyStats } {
  const core = createMinimalV2();
  const repository = createRepository();
  const repoStats = {
    totalRepos: 1,
    publicRepos: 1,
    privateRepos: 0,
    archivedRepos: 0,
    forkedRepos: 0,
    originalRepos: 1,
    activeRepos: 1,
    reposWithStars: 1,
    reposCreatedThisYear: 0,
    averageStarsPerRepo: 7,
  };
  const repoMetrics: RepoMetrics = {
    starCount: 7,
    forkCount: 2,
    codeByteTotal: 100,
    topLanguages: repository.languages,
    topTopics: [],
    contributorStats: {
      totalCommits: 2,
      linesAdded: 8,
      linesDeleted: 2,
      linesOfCodeChanged: 10,
      reposCompleted: 1,
      reposPending: 0,
      reposFailed: 0,
    },
    traffic: {
      repoViews: 5,
      repoViewUniques: 3,
      reposCompleted: 1,
      reposPending: 0,
      reposFailed: 0,
    },
    repoStats,
    computedStats: {
      ...repoStats,
      languageCount: 6,
      primaryLanguage: "TypeScript",
      primaryLanguageThisYear: "TypeScript",
      topLanguagesThisYear: repository.languages,
      totalTopics: 0,
      topTopics: [],
      allTopics: [],
      contributionsThisYear: 12,
      contributionsLastYear: 0,
      yearOverYearGrowth: null,
      mostProductiveMonth: { month: "2024-01", contributions: 12 },
    },
  };
  const activity = {
    totalPullRequests: 3,
    openIssues: 1,
    closedIssues: 2,
    repositoriesContributedTo: 1,
    discussionsStarted: 2,
    discussionsAnswered: 1,
    starsGiven: 4,
  };
  const { login, ...profileFields } = core.profile;
  const legacy: LegacyStats = {
    ...profileFields,
    ...activity,
    username: login,
    repoViews: 5,
    linesOfCodeChanged: 10,
    linesAdded: 8,
    linesDeleted: 2,
    commitCount: 2,
    totalCommits: 9,
    totalPullRequestReviews: 1,
    fetchedAt,
    forkCount: 2,
    starCount: 7,
    totalContributions: 12,
    codeByteTotal: 100,
    topLanguages: repository.languages,
    contributionStats: core.profileContributions.stats,
    repoStats,
    computedStats: repoMetrics.computedStats,
    contributionsCollection: createContributionsCollection(),
    topRepos: [
      {
        name: repository.name,
        nameWithOwner: repository.nameWithOwner,
        description: null,
        stars: 7,
        forks: 2,
        isArchived: false,
        isFork: false,
        isPrivate: false,
        primaryLanguage: "TypeScript",
        topics: [],
        updatedAt: generatedAt,
        createdAt: repository.createdAt,
      },
    ],
  };
  return {
    ...legacy,
    ...core,
    activity,
    repositories: [repository],
    repoMetrics,
    packageMetrics: emptyPackageMetrics(),
    legacy,
    presentation: {
      readmeSummary: {
        name: core.profile.name,
        username: login,
        totalContributions: 12,
        currentStreak: 2,
        longestStreak: 2,
        topLanguages: repository.languages.slice(0, 5),
        starsReceived: 7,
        forksReceived: 2,
        activeRepos: 1,
        refreshedAt: generatedAt,
        complete: true,
      },
      cards: [{ id: "commits", label: "Commits", value: 9 }],
      timeline: [{ period: "2024", contributions: 12 }],
      highlights: [
        { id: "peak", label: "Peak day", value: 5, detail: "2024-01-03" },
      ],
      remotion: {
        scenes: [
          {
            id: "intro",
            title: "Activity",
            metric: 12,
            supportingText: "Contributions",
          },
        ],
      },
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
      startedAt: fetchedAt - 1000,
      finishedAt: fetchedAt,
      durationMs: 1000,
      complete: true,
      coreComplete: true,
      cache: {
        stablePath: "cache.json",
        volatilePath: "volatile.json",
        contributionYearsFromCache: 0,
        contributionYearsFetched: 1,
        repositoriesFromCache: 0,
        repositoriesFetched: 1,
      },
      backfill: {
        enabled: true,
        completedThisRun: 2,
        pending: 0,
        failedThisRun: 0,
        skippedThisRun: 0,
      },
      rateLimit: {
        graphql: {
          limit: 5000,
          remaining: 4999,
          used: 1,
          resetAt: generatedAt,
        },
        rest: null,
      },
      warnings: [],
      errors: [],
    },
  };
}
