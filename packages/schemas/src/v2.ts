import { z } from "zod";
import {
  countSchema,
  dateSchema,
  dateTimeSchema,
  githubUsernameSchema,
  monthSchema,
  nonnegativeNumberSchema,
  percentageSchema,
  timestampSchema,
  yearSchema,
} from "./primitives.js";

export const OUTPUT_SCHEMA_VERSION = 2;
export const CACHE_SCHEMA_VERSION = 1;

export const languageSchema = z.object({
  languageName: z.string().min(1),
  color: z.string().nullable(),
  value: countSchema,
  percentage: percentageSchema,
});

export const contributionDaySchema = z.object({
  contributionCount: countSchema,
  date: dateSchema,
});

export const contributionWeekSchema = z.object({
  contributionDays: z.array(contributionDaySchema),
});

export const contributionCalendarSchema = z.object({
  totalContributions: countSchema,
  weeks: z.array(contributionWeekSchema),
});

export const contributionsCollectionSchema = z.object({
  totalCommitContributions: countSchema,
  restrictedContributionsCount: countSchema,
  totalIssueContributions: countSchema,
  totalRepositoryContributions: countSchema,
  totalPullRequestContributions: countSchema,
  totalPullRequestReviewContributions: countSchema,
  contributionCalendar: contributionCalendarSchema,
});

export const monthlyContributionSchema = z.object({
  month: monthSchema,
  contributions: countSchema,
});

export const yearlyContributionSchema = z.object({
  year: yearSchema,
  contributions: countSchema,
});

export const peakDaySchema = z.object({
  date: dateSchema,
  contributions: countSchema,
});

export const contributionStatsSchema = z.object({
  longestStreak: countSchema,
  currentStreak: countSchema,
  mostActiveDay: z.string(),
  averagePerDay: nonnegativeNumberSchema,
  averagePerWeek: nonnegativeNumberSchema,
  averagePerMonth: nonnegativeNumberSchema,
  monthlyBreakdown: z.array(monthlyContributionSchema),
  yearlyBreakdown: z.array(yearlyContributionSchema),
  peakDay: peakDaySchema.nullable(),
});

export const rateLimitInfoSchema = z.object({
  limit: countSchema,
  remaining: countSchema,
  used: countSchema,
  resetAt: dateTimeSchema,
});

export const collectionSourceSchema = z.enum([
  "owned",
  "affiliated",
  "contributed",
  "profile-contribution",
  "cache",
]);

export const repositoryContributionCountsSchema = z.object({
  commits: countSchema,
  issues: countSchema,
  pullRequests: countSchema,
  pullRequestReviews: countSchema,
  repositoryCreations: countSchema,
});

export const repoDetailsSchema = z.object({
  name: z.string().min(1),
  nameWithOwner: z.string().min(1),
  description: z.string().nullable(),
  stars: countSchema,
  forks: countSchema,
  isArchived: z.boolean(),
  isFork: z.boolean(),
  isPrivate: z.boolean(),
  primaryLanguage: z.string().nullable(),
  topics: z.array(z.string()),
  updatedAt: dateTimeSchema,
  createdAt: dateTimeSchema,
});

export const repositoryRecordSchema = repoDetailsSchema.extend({
  id: z.string().min(1),
  owner: z.string().min(1),
  ownerType: z.string().nullable(),
  url: z.string().nullable(),
  visibility: z.string().nullable(),
  viewerPermission: z.string().nullable(),
  pushedAt: dateTimeSchema.nullable(),
  defaultBranchOid: z.string().nullable(),
  languages: z.array(languageSchema),
  codeByteTotal: countSchema,
  sources: z.array(collectionSourceSchema),
  contributionCounts: repositoryContributionCountsSchema,
  metadataFetchedAt: timestampSchema,
});

export const repoStatsSchema = z.object({
  totalRepos: countSchema,
  publicRepos: countSchema,
  privateRepos: countSchema,
  archivedRepos: countSchema,
  forkedRepos: countSchema,
  originalRepos: countSchema,
  activeRepos: countSchema,
  reposWithStars: countSchema,
  reposCreatedThisYear: countSchema,
  averageStarsPerRepo: nonnegativeNumberSchema,
});

export const topicCountSchema = z.object({
  name: z.string(),
  count: countSchema,
});

export const computedStatsSchema = repoStatsSchema.extend({
  languageCount: countSchema,
  primaryLanguage: z.string().nullable(),
  primaryLanguageThisYear: z.string().nullable(),
  topLanguagesThisYear: z.array(languageSchema),
  totalTopics: countSchema,
  topTopics: z.array(topicCountSchema),
  allTopics: z.array(z.string()),
  contributionsThisYear: countSchema,
  contributionsLastYear: countSchema,
  yearOverYearGrowth: z.number().finite().nullable(),
  mostProductiveMonth: monthlyContributionSchema.nullable(),
});

export const userProfileSchema = z.object({
  name: z.string(),
  login: githubUsernameSchema,
  bio: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  email: z.string().nullable(),
  twitterUsername: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  avatarUrl: z.string(),
  createdAt: dateTimeSchema,
  followers: countSchema,
  following: countSchema,
});

export const activityStatsSchema = z.object({
  totalPullRequests: countSchema,
  openIssues: countSchema,
  closedIssues: countSchema,
  repositoriesContributedTo: countSchema,
  discussionsStarted: countSchema,
  discussionsAnswered: countSchema,
  starsGiven: countSchema,
});

export const repositoryContributionSummarySchema = z.object({
  repositoryId: z.string().min(1),
  nameWithOwner: z.string().min(1),
  owner: z.string().min(1),
  counts: repositoryContributionCountsSchema,
});

export const profileContributionsSchema = contributionsCollectionSchema.extend({
  totalContributions: countSchema,
  stats: contributionStatsSchema,
  repositoryContributions: z.array(repositoryContributionSummarySchema),
  completeness: z.object({
    complete: z.boolean(),
    yearsFetched: z.array(yearSchema),
    yearsFromCache: z.array(yearSchema),
    missingYears: z.array(yearSchema),
  }),
});

export const repositoryMetricCoverageSchema = z.object({
  reposCompleted: countSchema,
  reposPending: countSchema,
  reposFailed: countSchema,
});

export const contributorStatsSchema = repositoryMetricCoverageSchema.extend({
  totalCommits: countSchema,
  linesAdded: countSchema,
  linesDeleted: countSchema,
  linesOfCodeChanged: countSchema,
});

export const trafficSchema = repositoryMetricCoverageSchema.extend({
  repoViews: countSchema,
  repoViewUniques: countSchema,
});

export const repoMetricsSchema = z.object({
  starCount: countSchema,
  forkCount: countSchema,
  codeByteTotal: countSchema,
  topLanguages: z.array(languageSchema),
  topTopics: z.array(topicCountSchema),
  profile: z.object({
    totalRepos: countSchema.optional(),
    publicRepos: countSchema,
    privateRepos: countSchema.optional(),
    originalRepos: countSchema,
    forkedRepos: countSchema,
    activeOriginalRepos: countSchema,
    archivedOriginalRepos: countSchema,
    reposWithStars: countSchema,
    starsReceived: countSchema,
    forksReceived: countSchema,
    codeByteTotal: countSchema,
    topLanguages: z.array(languageSchema),
  }).optional(),
  contributorStats: contributorStatsSchema,
  traffic: trafficSchema,
  repoStats: repoStatsSchema,
  computedStats: computedStatsSchema,
});

export const packageDownloadCountsSchema = z.object({
  lastDay: countSchema,
  lastWeek: countSchema,
  lastMonth: countSchema,
  lastYear: countSchema,
  allTime: countSchema,
});

export const packageMetricSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  latestVersion: z.string().nullable(),
  latestPublishedAt: dateTimeSchema.nullable(),
  downloads: packageDownloadCountsSchema,
});

export const packageMetricsSchema = z.object({
  packageCount: countSchema,
  providers: z.array(z.string()),
  downloads: packageDownloadCountsSchema,
  packages: z.array(packageMetricSchema),
  complete: z.boolean(),
  warnings: z.array(z.string()),
});

export const metricCardSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string(), z.number().finite()]),
  detail: z.string().optional(),
});

export const timelinePointSchema = z.object({
  period: z.string().min(1),
  contributions: countSchema,
});

export const presentationSchema = z.object({
  readmeSummary: z.object({
    name: z.string(),
    username: githubUsernameSchema,
    totalContributions: countSchema,
    currentStreak: countSchema,
    longestStreak: countSchema,
    topLanguages: z.array(languageSchema),
    starsReceived: countSchema,
    forksReceived: countSchema,
    totalRepos: countSchema.optional(),
    originalRepos: countSchema.optional(),
    activeRepos: countSchema,
    languageCount: countSchema.optional(),
    codeByteTotal: countSchema.optional(),
    refreshedAt: dateTimeSchema,
    complete: z.boolean(),
  }),
  cards: z.array(metricCardSchema),
  timeline: z.array(timelinePointSchema),
  highlights: z.array(metricCardSchema),
  remotion: z.object({
    scenes: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string(),
        metric: z.union([z.string(), z.number().finite()]),
        supportingText: z.string().optional(),
      }),
    ),
  }),
});

export const privacyReportSchema = z.object({
  privateRepositoryMetricsIncluded: z.boolean(),
  privateRepositoryDetailsIncluded: z.boolean(),
  privateCacheDetailsIncluded: z.boolean(),
  redactedPrivateRepositories: countSchema,
  redactedRepositoryContributions: countSchema,
  redactedOptionalMetrics: countSchema,
});

export const collectionStatusSchema = z.object({
  startedAt: timestampSchema,
  finishedAt: timestampSchema,
  durationMs: countSchema,
  complete: z.boolean(),
  coreComplete: z.boolean(),
  cache: z.object({
    stablePath: z.string(),
    volatilePath: z.string(),
    contributionYearsFromCache: countSchema,
    contributionYearsFetched: countSchema,
    repositoriesFromCache: countSchema,
    repositoriesFetched: countSchema,
  }),
  backfill: z.object({
    enabled: z.boolean(),
    completedThisRun: countSchema,
    pending: countSchema,
    failedThisRun: countSchema,
    skippedThisRun: countSchema,
  }),
  rateLimit: z.object({
    graphql: rateLimitInfoSchema.nullable(),
    rest: rateLimitInfoSchema.nullable(),
  }),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

export const legacyStatsSchema = userProfileSchema
  .omit({ login: true })
  .extend({
    username: githubUsernameSchema,
    repoViews: countSchema,
    linesOfCodeChanged: countSchema,
    linesAdded: countSchema,
    linesDeleted: countSchema,
    commitCount: countSchema,
    totalCommits: countSchema,
    ...activityStatsSchema.shape,
    totalPullRequestReviews: countSchema,
    fetchedAt: timestampSchema,
    forkCount: countSchema,
    starCount: countSchema,
    totalContributions: countSchema,
    codeByteTotal: countSchema,
    topLanguages: z.array(languageSchema),
    contributionStats: contributionStatsSchema,
    repoStats: repoStatsSchema,
    computedStats: computedStatsSchema,
    contributionsCollection: contributionsCollectionSchema,
    topRepos: z.array(repoDetailsSchema),
  });

/** Canonical producer output. Legacy input is validated separately and never re-emitted. */
export const githubStatsOutputSchema = z.object({
  schemaVersion: z.literal(OUTPUT_SCHEMA_VERSION),
  generatedAt: dateTimeSchema,
  profile: userProfileSchema,
  profileContributions: profileContributionsSchema,
  activity: activityStatsSchema,
  repositories: z.array(repositoryRecordSchema),
  repoMetrics: repoMetricsSchema,
  packageMetrics: packageMetricsSchema,
  presentation: presentationSchema,
  privacy: privacyReportSchema,
  collectionStatus: collectionStatusSchema,
});

// Public field contracts are inferred from the same schemas used at runtime.
export type Language = z.infer<typeof languageSchema>;
export type ContributionData = z.infer<typeof contributionDaySchema>;
export type ContributionWeek = z.infer<typeof contributionWeekSchema>;
export type ContributionsCollection = z.infer<
  typeof contributionsCollectionSchema
>;
export type MonthlyContribution = z.infer<typeof monthlyContributionSchema>;
export type YearlyContribution = z.infer<typeof yearlyContributionSchema>;
export type ContributionStats = z.infer<typeof contributionStatsSchema>;
export type RateLimitInfo = z.infer<typeof rateLimitInfoSchema>;
export type CollectionSource = z.infer<typeof collectionSourceSchema>;
export type RepositoryContributionCounts = z.infer<
  typeof repositoryContributionCountsSchema
>;
export type RepositoryRecord = z.infer<typeof repositoryRecordSchema>;
export type RepoDetails = z.infer<typeof repoDetailsSchema>;
export type RepoStats = z.infer<typeof repoStatsSchema>;
export type TopicCount = z.infer<typeof topicCountSchema>;
export type ComputedStats = z.infer<typeof computedStatsSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type ActivityStats = z.infer<typeof activityStatsSchema>;
export type RepositoryContributionSummary = z.infer<
  typeof repositoryContributionSummarySchema
>;
export type ProfileContributions = z.infer<typeof profileContributionsSchema>;
export type RepoMetrics = z.infer<typeof repoMetricsSchema>;
export type PackageDownloadCounts = z.infer<typeof packageDownloadCountsSchema>;
export type PackageMetric = z.infer<typeof packageMetricSchema>;
export type PackageMetrics = z.infer<typeof packageMetricsSchema>;

export function emptyPackageMetrics(): PackageMetrics {
  return {
    packageCount: 0,
    providers: [],
    downloads: { lastDay: 0, lastWeek: 0, lastMonth: 0, lastYear: 0, allTime: 0 },
    packages: [],
    complete: true,
    warnings: [],
  };
}
export type PresentationData = z.infer<typeof presentationSchema>;
export type PrivacyReport = z.infer<typeof privacyReportSchema>;
export type CollectionStatus = z.infer<typeof collectionStatusSchema>;
export type LegacyStats = z.infer<typeof legacyStatsSchema>;
export type GitHubStatsOutput = z.infer<typeof githubStatsOutputSchema>;
