import { z } from "zod";

export const renderLanguageSchema = z.object({
  languageName: z.string(),
  color: z.string().nullable(),
  value: z.number(),
  percentage: z.number().optional(),
});

export const contributionDaySchema = z.object({
  contributionCount: z.number(),
  date: z.string(),
});

export const timelinePointSchema = z.object({
  period: z.string(),
  contributions: z.number(),
});

export const metricCardSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  detail: z.string().optional(),
});

export const userStatsSchema = z.object({
  schemaVersion: z.number().nullable(),
  name: z.string(),
  username: z.string(),
  avatarUrl: z.string(),
  bio: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  location: z.string().nullable(),
  generatedAt: z.string(),
  fetchedAt: z.number(),
  isComplete: z.boolean(),
  summary: z.object({
    totalContributions: z.number(),
    currentStreak: z.number(),
    longestStreak: z.number(),
    starsReceived: z.number(),
    forksReceived: z.number(),
    activeRepos: z.number(),
    totalRepos: z.number(),
    languageCount: z.number(),
    refreshedAt: z.string(),
  }),
  contributions: z.object({
    totalContributions: z.number(),
    totalCommits: z.number(),
    restrictedContributionsCount: z.number(),
    currentStreak: z.number(),
    longestStreak: z.number(),
    peakDay: z
      .object({
        date: z.string(),
        contributions: z.number(),
      })
      .nullable(),
    mostProductiveMonth: z
      .object({
        month: z.string(),
        contributions: z.number(),
      })
      .nullable(),
    calendar: z.array(contributionDaySchema),
    timeline: z.array(timelinePointSchema),
  }),
  code: z.object({
    codeByteTotal: z.number(),
    linesAdded: z.number(),
    linesDeleted: z.number(),
    linesChanged: z.number(),
    linesOfCodeChanged: z.number(),
    contributorReposCompleted: z.number(),
    contributorReposPending: z.number(),
    contributorReposFailed: z.number(),
  }),
  community: z.object({
    totalPullRequests: z.number(),
    totalPullRequestReviews: z.number(),
    openIssues: z.number(),
    closedIssues: z.number(),
    repositoriesContributedTo: z.number(),
    discussionsStarted: z.number(),
    discussionsAnswered: z.number(),
    starsGiven: z.number(),
    followers: z.number(),
    following: z.number(),
  }),
  repositories: z.object({
    totalRepos: z.number(),
    publicRepos: z.number(),
    privateRepos: z.number(),
    activeRepos: z.number(),
    archivedRepos: z.number(),
    forkedRepos: z.number(),
    originalRepos: z.number(),
    reposWithStars: z.number(),
    repoViews: z.number(),
    repoViewUniques: z.number(),
    trafficReposCompleted: z.number(),
    trafficReposPending: z.number(),
    trafficReposFailed: z.number(),
    starCount: z.number(),
    forkCount: z.number(),
  }),
  topLanguages: z.array(renderLanguageSchema),
  cards: z.array(metricCardSchema),
  highlights: z.array(metricCardSchema),
  privacy: z.object({
    privateRepositoryDetailsIncluded: z.boolean(),
    privateCacheDetailsIncluded: z.boolean(),
    redactedPrivateRepositories: z.number(),
    redactedRepositoryContributions: z.number(),
    redactedOptionalMetrics: z.number(),
  }),
  collectionStatus: z.object({
    complete: z.boolean(),
    coreComplete: z.boolean(),
    backfillPending: z.number(),
    backfillCompletedThisRun: z.number(),
    backfillFailedThisRun: z.number(),
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
  }),
  repoViews: z.number(),
  linesOfCodeChanged: z.number(),
  linesAdded: z.number(),
  linesDeleted: z.number(),
  linesChanged: z.number(),
  totalCommits: z.number(),
  totalPullRequests: z.number(),
  totalPullRequestReviews: z.number(),
  openIssues: z.number(),
  closedIssues: z.number(),
  forkCount: z.number(),
  starCount: z.number(),
  totalContributions: z.number(),
  codeByteTotal: z.number(),
});

export const sourcePropsSchema = z.object({
  username: z.string().optional(),
  usernames: z.array(z.string()).optional(),
  statsUrl: z.string().optional(),
  stats: z.unknown().optional(),
  allowPrivateRepositoryDetails: z.boolean().optional(),
});

export const mainSchema = z.object({
  userStats: userStatsSchema,
});

export type RenderLanguage = z.infer<typeof renderLanguageSchema>;
export type MetricCard = z.infer<typeof metricCardSchema>;
export type SourceProps = z.infer<typeof sourcePropsSchema>;
export type MainProps = z.infer<typeof mainSchema>;
export type UserStats = z.infer<typeof userStatsSchema>;
