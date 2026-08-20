import { z } from "zod";
import {
  OUTPUT_SCHEMA_VERSION,
  type GitHubStatsOutput,
} from "./v2.js";

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

export const packageDownloadCountsSchema = z.object({
  lastDay: z.number(),
  lastWeek: z.number(),
  lastMonth: z.number(),
  lastYear: z.number(),
  allTime: z.number(),
});

export const packageMetricSchema = z.object({
  provider: z.string(),
  name: z.string(),
  url: z.string(),
  latestVersion: z.string().nullable(),
  latestPublishedAt: z.string().nullable(),
  downloads: packageDownloadCountsSchema,
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
    profileMetricsComplete: z.boolean(),
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
    repoViews: z.number().nullable(),
    repoViewUniques: z.number().nullable(),
    trafficReposCompleted: z.number(),
    trafficReposPending: z.number(),
    trafficReposFailed: z.number(),
    starCount: z.number(),
    forkCount: z.number(),
  }),
  topLanguages: z.array(renderLanguageSchema),
  packages: z.object({
    packageCount: z.number(),
    providers: z.array(z.string()),
    downloads: packageDownloadCountsSchema,
    packages: z.array(packageMetricSchema),
    complete: z.boolean(),
    warnings: z.array(z.string()),
  }),
  cards: z.array(metricCardSchema),
  highlights: z.array(metricCardSchema),
  privacy: z.object({
    privateRepositoryMetricsIncluded: z.boolean(),
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
  repoViews: z.number().nullable(),
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

// ---------------------------------------------------------------------------
// Canonical v2 output document (written by the collector, read by the renderer)
// ---------------------------------------------------------------------------

const languageSchema = z.object({
  languageName: z.string(),
  color: z.string().nullable(),
  value: z.number(),
  percentage: z.number(),
});

const contributionDay = z.object({
  contributionCount: z.number(),
  date: z.string(),
});

const contributionWeek = z.object({ contributionDays: z.array(contributionDay) });

const contributionStatsSchema = z.object({
  longestStreak: z.number(),
  currentStreak: z.number(),
  mostActiveDay: z.string(),
  averagePerDay: z.number(),
  averagePerWeek: z.number(),
  averagePerMonth: z.number(),
  monthlyBreakdown: z.array(
    z.object({ month: z.string(), contributions: z.number() })
  ),
  yearlyBreakdown: z.array(
    z.object({ year: z.string(), contributions: z.number() })
  ),
  peakDay: z
    .object({ date: z.string(), contributions: z.number() })
    .nullable(),
});

const repositoryContributionCountsSchema = z.object({
  commits: z.number(),
  issues: z.number(),
  pullRequests: z.number(),
  pullRequestReviews: z.number(),
  repositoryCreations: z.number(),
});

const repositoryRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameWithOwner: z.string(),
  owner: z.string(),
  ownerType: z.string().nullable(),
  description: z.string().nullable(),
  url: z.string().nullable(),
  isArchived: z.boolean(),
  isFork: z.boolean(),
  isPrivate: z.boolean(),
  visibility: z.string().nullable(),
  viewerPermission: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pushedAt: z.string().nullable(),
  defaultBranchOid: z.string().nullable(),
  stars: z.number(),
  forks: z.number(),
  primaryLanguage: z.string().nullable(),
  topics: z.array(z.string()),
  languages: z.array(languageSchema),
  codeByteTotal: z.number(),
  sources: z.array(
    z.enum(["owned", "affiliated", "contributed", "profile-contribution", "cache"])
  ),
  contributionCounts: repositoryContributionCountsSchema,
  metadataFetchedAt: z.number(),
});

const repoStatsSchema = z.object({
  totalRepos: z.number(),
  publicRepos: z.number(),
  privateRepos: z.number(),
  archivedRepos: z.number(),
  forkedRepos: z.number(),
  originalRepos: z.number(),
  activeRepos: z.number(),
  reposWithStars: z.number(),
  reposCreatedThisYear: z.number(),
  averageStarsPerRepo: z.number(),
});

const computedStatsSchema = repoStatsSchema.extend({
  languageCount: z.number(),
  primaryLanguage: z.string().nullable(),
  primaryLanguageThisYear: z.string().nullable(),
  topLanguagesThisYear: z.array(languageSchema),
  totalTopics: z.number(),
  topTopics: z.array(z.object({ name: z.string(), count: z.number() })),
  allTopics: z.array(z.string()),
  contributionsThisYear: z.number(),
  contributionsLastYear: z.number(),
  yearOverYearGrowth: z.number().nullable(),
  mostProductiveMonth: z
    .object({ month: z.string(), contributions: z.number() })
    .nullable(),
});

const userProfileSchema = z.object({
  name: z.string(),
  login: z.string(),
  bio: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  email: z.string().nullable(),
  twitterUsername: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  avatarUrl: z.string(),
  createdAt: z.string(),
  followers: z.number(),
  following: z.number(),
});

const activityStatsSchema = z.object({
  totalPullRequests: z.number(),
  openIssues: z.number(),
  closedIssues: z.number(),
  repositoriesContributedTo: z.number(),
  discussionsStarted: z.number(),
  discussionsAnswered: z.number(),
  starsGiven: z.number(),
});

const repoMetricsSchema = z.object({
  starCount: z.number(),
  forkCount: z.number(),
  codeByteTotal: z.number(),
  topLanguages: z.array(languageSchema),
  topTopics: z.array(z.object({ name: z.string(), count: z.number() })),
  profile: z
    .object({
      totalRepos: z.number().optional(),
      publicRepos: z.number(),
      privateRepos: z.number().optional(),
      originalRepos: z.number(),
      forkedRepos: z.number(),
      activeOriginalRepos: z.number(),
      archivedOriginalRepos: z.number(),
      reposWithStars: z.number(),
      starsReceived: z.number(),
      forksReceived: z.number(),
      codeByteTotal: z.number(),
      topLanguages: z.array(languageSchema),
    })
    .optional(),
  contributorStats: z.object({
    totalCommits: z.number(),
    linesAdded: z.number(),
    linesDeleted: z.number(),
    linesOfCodeChanged: z.number(),
    reposCompleted: z.number(),
    reposPending: z.number(),
    reposFailed: z.number(),
  }),
  traffic: z.object({
    repoViews: z.number(),
    repoViewUniques: z.number(),
    reposCompleted: z.number(),
    reposPending: z.number(),
    reposFailed: z.number(),
  }),
  repoStats: repoStatsSchema,
  computedStats: computedStatsSchema,
});

const packageDownloadCountsSchema2 = z.object({
  lastDay: z.number(),
  lastWeek: z.number(),
  lastMonth: z.number(),
  lastYear: z.number(),
  allTime: z.number(),
});

const packageMetricsSchema2 = z.object({
  packageCount: z.number(),
  providers: z.array(z.string()),
  downloads: packageDownloadCountsSchema2,
  packages: z.array(
    z.object({
      provider: z.string(),
      name: z.string(),
      url: z.string(),
      latestVersion: z.string().nullable(),
      latestPublishedAt: z.string().nullable(),
      downloads: packageDownloadCountsSchema2,
    })
  ),
  complete: z.boolean(),
  warnings: z.array(z.string()),
});

const presentationDataSchema = z.object({
  readmeSummary: z.object({
    name: z.string(),
    username: z.string(),
    totalContributions: z.number(),
    currentStreak: z.number(),
    longestStreak: z.number(),
    topLanguages: z.array(languageSchema),
    starsReceived: z.number(),
    forksReceived: z.number(),
    totalRepos: z.number().optional(),
    originalRepos: z.number().optional(),
    activeRepos: z.number(),
    languageCount: z.number().optional(),
    codeByteTotal: z.number().optional(),
    refreshedAt: z.string(),
    complete: z.boolean(),
  }),
  cards: z.array(metricCardSchema),
  timeline: z.array(timelinePointSchema),
  highlights: z.array(metricCardSchema),
  remotion: z.object({
    scenes: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        metric: z.union([z.string(), z.number()]),
        supportingText: z.string().optional(),
      })
    ),
  }),
});

const privacyReportSchema = z.object({
  privateRepositoryMetricsIncluded: z.boolean(),
  privateRepositoryDetailsIncluded: z.boolean(),
  privateCacheDetailsIncluded: z.boolean(),
  redactedPrivateRepositories: z.number(),
  redactedRepositoryContributions: z.number(),
  redactedOptionalMetrics: z.number(),
});

const collectionStatusSchema = z.object({
  startedAt: z.number(),
  finishedAt: z.number(),
  durationMs: z.number(),
  complete: z.boolean(),
  coreComplete: z.boolean(),
  cache: z.object({
    stablePath: z.string(),
    volatilePath: z.string(),
    contributionYearsFromCache: z.number(),
    contributionYearsFetched: z.number(),
    repositoriesFromCache: z.number(),
    repositoriesFetched: z.number(),
  }),
  backfill: z.object({
    enabled: z.boolean(),
    completedThisRun: z.number(),
    pending: z.number(),
    failedThisRun: z.number(),
    skippedThisRun: z.number(),
  }),
  rateLimit: z.object({
    graphql: z
      .object({
        limit: z.number(),
        remaining: z.number(),
        used: z.number(),
        resetAt: z.string(),
      })
      .nullable(),
    rest: z
      .object({
        limit: z.number(),
        remaining: z.number(),
        used: z.number(),
        resetAt: z.string(),
      })
      .nullable(),
  }),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

export const githubStatsOutputSchema = z.object({
  schemaVersion: z.literal(OUTPUT_SCHEMA_VERSION),
  generatedAt: z.string(),
  profile: userProfileSchema,
  profileContributions: z.object({
    totalContributions: z.number(),
    totalCommitContributions: z.number(),
    restrictedContributionsCount: z.number(),
    totalIssueContributions: z.number(),
    totalRepositoryContributions: z.number(),
    totalPullRequestContributions: z.number(),
    totalPullRequestReviewContributions: z.number(),
    contributionCalendar: z.object({
      totalContributions: z.number(),
      weeks: z.array(contributionWeek),
    }),
    stats: contributionStatsSchema,
    repositoryContributions: z.array(
      z.object({
        repositoryId: z.string(),
        nameWithOwner: z.string(),
        owner: z.string(),
        counts: repositoryContributionCountsSchema,
      })
    ),
    completeness: z.object({
      complete: z.boolean(),
      yearsFetched: z.array(z.string()),
      yearsFromCache: z.array(z.string()),
      missingYears: z.array(z.string()),
    }),
  }),
  activity: activityStatsSchema,
  repositories: z.array(repositoryRecordSchema),
  repoMetrics: repoMetricsSchema,
  packageMetrics: packageMetricsSchema2,
  presentation: presentationDataSchema,
  privacy: privacyReportSchema,
  collectionStatus: collectionStatusSchema,
});

// Compile-time guarantee that the Zod schema and the hand-written v2 type stay
// in sync; if either drifts, this assignment stops compiling.
const _schemaMatchesType: GitHubStatsOutput = {} as z.infer<typeof githubStatsOutputSchema>;
void _schemaMatchesType;
