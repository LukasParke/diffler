import { z } from "zod";
import { countSchema } from "./primitives.js";
import {
  computedStatsSchema,
  contributionsCollectionSchema,
  contributionStatsSchema,
  githubStatsOutputSchema,
  languageSchema,
  legacyStatsSchema,
  presentationSchema,
  packageMetricsSchema,
  privacyReportSchema,
  repoMetricsSchema,
  repoStatsSchema,
} from "./v2.js";

export const renderLanguageSchema = languageSchema.partial({
  percentage: true,
});

const privacyInputSchema = privacyReportSchema.extend({
  privateRepositoryMetricsIncluded: z.boolean().default(false),
});

/** Older exports used name/bytes, or omitted language colors and percentages. */
export const legacyLanguageInputSchema = z.union([
  renderLanguageSchema.extend({
    color: languageSchema.shape.color.default(null),
  }),
  z
    .object({
      name: languageSchema.shape.languageName,
      bytes: languageSchema.shape.value,
      color: languageSchema.shape.color.default(null),
      percentage: languageSchema.shape.percentage.optional(),
    })
    .transform(({ name, bytes, color, percentage }) => ({
      languageName: name,
      value: bytes,
      color,
      ...(percentage === undefined ? {} : { percentage }),
    })),
]);

/**
 * A renderable v2 document requires the canonical profile, contribution data and
 * generation time. Repository/activity/collection groups may be absent; this is
 * incomplete data, not a complete profile with measured zero repository metrics.
 * Legacy aliases and presentation are not required. Present groups are validated.
 */
export const githubStatsV2InputSchema = githubStatsOutputSchema
  .partial()
  .required({
    schemaVersion: true,
    generatedAt: true,
    profile: true,
    profileContributions: true,
  })
  .extend({
    repoMetrics: repoMetricsSchema
      .partial({
        contributorStats: true,
        traffic: true,
      })
      .optional(),
    presentation: presentationSchema.partial().optional(),
    privacy: privacyInputSchema.optional(),
    // Historical v2 exports may carry aliases; validate them before the privacy guard.
    topRepos: legacyStatsSchema.shape.topRepos.optional(),
    legacy: legacyStatsSchema.partial().optional(),
    error: z.never().optional(),
    errors: z.never().optional(),
  });

/**
 * Explicit versionless legacy support. Identity, a timestamp, contribution total
 * and a commit counter are required. Older optional fields can be absent, but
 * malformed supplied values are never coerced. Legacy has no coverage guarantee.
 */
export const legacyStatsInputSchema = legacyStatsSchema
  .partial()
  .required({
    username: true,
    fetchedAt: true,
    totalContributions: true,
  })
  .extend({
    schemaVersion: z.undefined().optional(),
    generatedAt: z.never().optional(),
    profile: z.never().optional(),
    profileContributions: z.never().optional(),
    repoMetrics: z.never().optional(),
    legacy: z.never().optional(),
    error: z.never().optional(),
    errors: z.never().optional(),
    topLanguages: z.array(legacyLanguageInputSchema).optional(),
    contributionStats: contributionStatsSchema.partial().optional(),
    contributionsCollection: contributionsCollectionSchema
      .partial()
      .required({
        contributionCalendar: true,
      })
      .optional(),
    repoStats: repoStatsSchema.partial().optional(),
    computedStats: computedStatsSchema.partial().optional(),
    privacy: privacyInputSchema.optional(),
    packageMetrics: packageMetricsSchema.optional(),
    linesChanged: countSchema.optional(),
    totalRepos: countSchema.optional(),
  })
  .refine(
    (stats) =>
      stats.totalCommits !== undefined ||
      stats.commitCount !== undefined ||
      stats.contributionsCollection?.totalCommitContributions !== undefined,
    {
      message:
        "Legacy stats require totalCommits, commitCount or contribution commit totals",
      path: ["totalCommits"],
    },
  );

/** Only v2 or explicitly versionless legacy input; unknown versions fail closed. */
export const githubStatsInputSchema = z.union([
  githubStatsV2InputSchema,
  legacyStatsInputSchema,
]);

export type GitHubStatsV2Input = z.infer<typeof githubStatsV2InputSchema>;
export type LegacyStatsInput = z.infer<typeof legacyStatsInputSchema>;
export type GitHubStatsInput = z.infer<typeof githubStatsInputSchema>;

export function hasPrivateRepositoryDetails(stats: GitHubStatsInput): boolean {
  return stats.privacy?.privateRepositoryDetailsIncluded === true ||
    stats.topRepos?.some((repository) => repository.isPrivate) === true ||
    (stats.schemaVersion === 2 &&
      (stats.repositories?.some((repository) => repository.isPrivate || repository.visibility === "PRIVATE") === true ||
        stats.legacy?.topRepos?.some((repository) => repository.isPrivate) === true));
}
