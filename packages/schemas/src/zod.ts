import { z } from "zod";
import { githubStatsInputSchema, renderLanguageSchema } from "./input.js";
import {
  countSchema,
  dateTimeSchema,
  githubUsernameSchema,
  timestampSchema,
} from "./primitives.js";
import {
  contributionDaySchema,
  metricCardSchema,
  monthlyContributionSchema,
  peakDaySchema,
  packageMetricsSchema,
  privacyReportSchema,
  timelinePointSchema,
} from "./v2.js";

export { renderLanguageSchema } from "./input.js";
export { githubStatsOutputSchema, packageDownloadCountsSchema, packageMetricSchema, packageMetricsSchema } from "./v2.js";
export {
  contributionDaySchema,
  timelinePointSchema,
  metricCardSchema,
} from "./v2.js";

export const userStatsSchema = z.object({
  // Keep the public number | null field type; only the known raw version is valid.
  schemaVersion: z
    .number()
    .refine(
      (version): boolean => version === 2,
      "Unsupported stats schema version",
    )
    .nullable(),
  name: z.string(),
  username: githubUsernameSchema,
  avatarUrl: z.string(),
  bio: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  location: z.string().nullable(),
  generatedAt: dateTimeSchema,
  fetchedAt: timestampSchema,
  isComplete: z.boolean(),
  summary: z.object({
    totalContributions: countSchema,
    currentStreak: countSchema,
    longestStreak: countSchema,
    starsReceived: countSchema,
    forksReceived: countSchema,
    activeRepos: countSchema,
    totalRepos: countSchema,
    languageCount: countSchema,
    profileMetricsComplete: z.boolean(),
    refreshedAt: dateTimeSchema,
  }),
  contributions: z.object({
    totalContributions: countSchema,
    totalCommits: countSchema,
    restrictedContributionsCount: countSchema,
    currentStreak: countSchema,
    longestStreak: countSchema,
    peakDay: peakDaySchema.nullable(),
    mostProductiveMonth: monthlyContributionSchema.nullable(),
    calendar: z.array(contributionDaySchema),
    timeline: z.array(timelinePointSchema),
  }),
  code: z.object({
    codeByteTotal: countSchema,
    linesAdded: countSchema,
    linesDeleted: countSchema,
    linesChanged: countSchema,
    linesOfCodeChanged: countSchema,
    contributorReposCompleted: countSchema,
    contributorReposPending: countSchema,
    contributorReposFailed: countSchema,
  }),
  community: z.object({
    totalPullRequests: countSchema,
    totalPullRequestReviews: countSchema,
    openIssues: countSchema,
    closedIssues: countSchema,
    repositoriesContributedTo: countSchema,
    discussionsStarted: countSchema,
    discussionsAnswered: countSchema,
    starsGiven: countSchema,
    followers: countSchema,
    following: countSchema,
  }),
  repositories: z.object({
    totalRepos: countSchema,
    publicRepos: countSchema,
    privateRepos: countSchema,
    activeRepos: countSchema,
    archivedRepos: countSchema,
    forkedRepos: countSchema,
    originalRepos: countSchema,
    reposWithStars: countSchema,
    repoViews: countSchema,
    repoViewUniques: countSchema,
    trafficReposCompleted: countSchema,
    trafficReposPending: countSchema,
    trafficReposFailed: countSchema,
    starCount: countSchema,
    forkCount: countSchema,
  }),
  topLanguages: z.array(renderLanguageSchema),
  packages: packageMetricsSchema,
  cards: z.array(metricCardSchema),
  highlights: z.array(metricCardSchema),
  privacy: privacyReportSchema,
  collectionStatus: z.object({
    complete: z.boolean(),
    coreComplete: z.boolean(),
    backfillPending: countSchema,
    backfillCompletedThisRun: countSchema,
    backfillFailedThisRun: countSchema,
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
  }),
  repoViews: countSchema,
  linesOfCodeChanged: countSchema,
  linesAdded: countSchema,
  linesDeleted: countSchema,
  linesChanged: countSchema,
  totalCommits: countSchema,
  totalPullRequests: countSchema,
  totalPullRequestReviews: countSchema,
  openIssues: countSchema,
  closedIssues: countSchema,
  forkCount: countSchema,
  starCount: countSchema,
  totalContributions: countSchema,
  codeByteTotal: countSchema,
});

/**
 * Explicit sources take precedence over userStats (which may be a composition's
 * demo default): stats, statsUrl, usernames, username, then normalized userStats.
 * At least one real source is required; there is no implicit network/demo fallback.
 */
export const sourcePropsSchema = z
  .object({
    username: githubUsernameSchema.optional(),
    usernames: z
      .array(githubUsernameSchema)
      .min(1)
      .refine(
        (names) =>
          new Set(names.map((name) => name.toLowerCase())).size ===
          names.length,
        "Duplicate GitHub usernames",
      )
      .optional(),
    statsUrl: z
      .string()
      .url()
      .regex(/^https?:\/\//i, "Expected an HTTP(S) stats URL")
      .optional(),
    stats: githubStatsInputSchema.optional(),
    userStats: userStatsSchema.optional(),
    allowPrivateRepositoryDetails: z.boolean().optional(),
  })
  .refine(
    (props) =>
      props.stats !== undefined ||
      props.statsUrl !== undefined ||
      props.usernames !== undefined ||
      props.username !== undefined ||
      props.userStats !== undefined,
    "Provide stats, statsUrl, usernames, username or normalized userStats",
  );

export const mainSchema = z.object({
  userStats: userStatsSchema,
});

export type RenderLanguage = z.infer<typeof renderLanguageSchema>;
export type MetricCard = z.infer<typeof metricCardSchema>;
export type SourceProps = z.input<typeof sourcePropsSchema>;
export type MainProps = z.infer<typeof mainSchema>;
export type UserStats = z.infer<typeof userStatsSchema>;
