import type {
  ActivityStats,
  CollectionStatus,
  GitHubStatsOutput,
  PackageMetrics,
  PrivacyReport,
  ProfileContributions,
  RepoMetrics,
  RepositoryRecord,
  StableCache,
  StatsActionConfig,
  UserProfile,
} from "./types.js";
import type { ContributionCollectionResult } from "./github.js";
import {
  OUTPUT_SCHEMA_VERSION,
  aggregateRepositoryLanguages,
  calculateComputedStats,
  calculateContributionStats,
  calculateRepoStats,
  calculateProfileRepoMetrics,
  buildPresentationData,
  emptyPackageMetrics,
} from "@lukasparke/diffler-schemas";
import { hasRepositoryKey, repositoryMetricCacheKey } from "./cache.js";

export function buildOutput(params: {
  profile: UserProfile;
  activity: ActivityStats;
  contributions: ContributionCollectionResult;
  repositories: RepositoryRecord[];
  cache: StableCache;
  config: StatsActionConfig;
  collectionStatus: CollectionStatus;
  fetchedAt: number;
  packageMetrics?: PackageMetrics;
}): GitHubStatsOutput {
  const includePrivateDetails = params.config.includePrivateRepositoryDetails;
  const includePrivateMetrics =
    includePrivateDetails || params.config.includePrivateRepositoryMetrics;
  const visibleRepositories = includePrivateDetails
    ? params.repositories
    : params.repositories.filter((repo) => !repo.isPrivate);
  const metricRepositories = includePrivateMetrics
    ? params.repositories
    : params.repositories.filter((repo) => !repo.isPrivate);
  const metricRepositoryIds = new Set(metricRepositories.map((repo) => repo.id));
  const metricCacheKeys = new Set(
    metricRepositories.map((repo) =>
      repositoryMetricCacheKey(repo, includePrivateDetails)
    )
  );
  const visibleRepositoriesById = new Map(visibleRepositories.map((repo) => [repo.id, repo]));
  const visibleRepositoryContributions = params.contributions.repositoryContributions.flatMap((summary) => {
    const repository = visibleRepositoriesById.get(summary.repositoryId);
    if (!repository) return [];
    return [{ ...summary, nameWithOwner: repository.nameWithOwner, owner: repository.owner }];
  });
  const contributionStats = calculateContributionStats(params.contributions.collection, params.fetchedAt);
  const { languages: topLanguages, codeByteTotal } =
    aggregateRepositoryLanguages(metricRepositories);
  const visibleComputedRepos = visibleRepositories.map(toComputedRepo);
  const metricComputedRepos = metricRepositories.map(toComputedRepo);
  const repoStats = calculateRepoStats(metricComputedRepos);
  const visibleComputedStats = calculateComputedStats(
    visibleComputedRepos,
    aggregateRepositoryLanguages(visibleRepositories).languages,
    contributionStats
  );
  const computedStats = {
    ...calculateComputedStats(metricComputedRepos, topLanguages, contributionStats),
    ...repoStats,
    topTopics: visibleComputedStats.topTopics,
    allTopics: visibleComputedStats.allTopics,
  };
  const metricContributorStats = metricRepositories
    .map(
      (repo) =>
        params.cache.contributorStats[
          repositoryMetricCacheKey(repo, includePrivateDetails)
        ]
    )
    .filter((stats) => stats !== undefined);
  const metricTrafficSummaries = metricRepositories
    .map(
      (repo) =>
        params.cache.traffic[repositoryMetricCacheKey(repo, includePrivateDetails)]
    )
    .filter((traffic) => traffic !== undefined);
  const ownedMetricRepos = metricRepositories.filter((repo) =>
    repo.sources.includes("owned")
  );
  const profileRepoMetrics = calculateProfileRepoMetrics(metricRepositories, params.fetchedAt);

  const linesAdded = metricContributorStats.reduce(
    (sum, stats) => sum + stats.additions,
    0
  );
  const linesDeleted = metricContributorStats.reduce(
    (sum, stats) => sum + stats.deletions,
    0
  );
  const commitCount = metricContributorStats.reduce(
    (sum, stats) => sum + stats.commits,
    0
  );
  const repoViews = metricTrafficSummaries.reduce(
    (sum, traffic) => sum + traffic.count,
    0
  );
  const repoViewUniques = metricTrafficSummaries.reduce(
    (sum, traffic) => sum + traffic.uniques,
    0
  );
  const starCount = ownedMetricRepos.reduce((sum, repo) => sum + repo.stars, 0);
  const forkCount = ownedMetricRepos.reduce((sum, repo) => sum + repo.forks, 0);
  const privacy = buildPrivacyReport({
    includePrivateRepositoryMetrics: includePrivateMetrics,
    includePrivateRepositoryDetails: includePrivateDetails,
    includePrivateCacheDetails: params.config.includePrivateCacheDetails,
    repositories: params.repositories,
    repositoryContributions: params.contributions.repositoryContributions.length,
    visibleRepositoryContributions: visibleRepositoryContributions.length,
    metricCacheKeys,
    cache: params.cache,
  });
  const collectionStatus = addPrivacyWarnings(params.collectionStatus, privacy);

  const repoMetrics: RepoMetrics = {
    starCount,
    forkCount,
    codeByteTotal,
    topLanguages,
    topTopics: computedStats.topTopics,
    profile: profileRepoMetrics,
    contributorStats: {
      totalCommits: commitCount,
      linesAdded,
      linesDeleted,
      linesOfCodeChanged: linesAdded + linesDeleted,
      reposCompleted: metricContributorStats.filter((stats) =>
        ["fresh", "cached"].includes(stats.status)
      ).length,
      reposPending: params.cache.backfill.pending.filter(
        (item) => item.type === "contributors" && metricRepositoryIds.has(item.repoId)
      ).length,
      reposFailed: Object.values(params.cache.backfill.failures).filter(
        (failure) =>
          failure.key.startsWith("contributors:") &&
          hasRepositoryKey(failure.key, metricRepositoryIds)
      ).length,
    },
    traffic: {
      repoViews,
      repoViewUniques,
      reposCompleted: metricTrafficSummaries.filter((traffic) =>
        ["fresh", "cached"].includes(traffic.status)
      ).length,
      reposPending: params.cache.backfill.pending.filter(
        (item) => item.type === "traffic" && metricRepositoryIds.has(item.repoId)
      ).length,
      reposFailed: Object.values(params.cache.backfill.failures).filter(
        (failure) =>
          failure.key.startsWith("traffic:") &&
          hasRepositoryKey(failure.key, metricRepositoryIds)
      ).length,
    },
    repoStats,
    computedStats,
  };

  const profileContributions: ProfileContributions = {
    totalContributions:
      params.contributions.collection.contributionCalendar.totalContributions,
    totalCommitContributions: params.contributions.collection.totalCommitContributions,
    restrictedContributionsCount:
      params.contributions.collection.restrictedContributionsCount,
    totalIssueContributions: params.contributions.collection.totalIssueContributions,
    totalRepositoryContributions:
      params.contributions.collection.totalRepositoryContributions,
    totalPullRequestContributions:
      params.contributions.collection.totalPullRequestContributions,
    totalPullRequestReviewContributions:
      params.contributions.collection.totalPullRequestReviewContributions,
    contributionCalendar: params.contributions.collection.contributionCalendar,
    stats: contributionStats,
    repositoryContributions: visibleRepositoryContributions,
    completeness: {
      complete: params.contributions.missingYears.length === 0,
      yearsFetched: params.contributions.yearsFetched,
      yearsFromCache: params.contributions.yearsFromCache,
      missingYears: params.contributions.missingYears,
    },
  };

  const presentation = buildPresentationData({
    profile: params.profile,
    profileContributions,
    repoMetrics,
    complete: collectionStatus.complete,
    fetchedAt: params.fetchedAt,
  });

  return {
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    generatedAt: new Date(params.fetchedAt).toISOString(),
    profile: params.profile,
    profileContributions,
    activity: params.activity,
    repositories: visibleRepositories,
    repoMetrics,
    packageMetrics: params.packageMetrics ?? emptyPackageMetrics(),
    presentation,
    privacy,
    collectionStatus,
  };
}

function toComputedRepo(repo: RepositoryRecord) {
  return {
    ...repo,
    languages: {
      edges: repo.languages.map((language) => ({
        size: language.value,
        node: {
          name: language.languageName,
          color: language.color,
        },
      })),
    },
  };
}

function buildPrivacyReport(params: {
  includePrivateRepositoryMetrics: boolean;
  includePrivateRepositoryDetails: boolean;
  includePrivateCacheDetails: boolean;
  repositories: RepositoryRecord[];
  repositoryContributions: number;
  visibleRepositoryContributions: number;
  metricCacheKeys: Set<string>;
  cache: StableCache;
}): PrivacyReport {
  return {
    privateRepositoryMetricsIncluded: params.includePrivateRepositoryMetrics,
    privateRepositoryDetailsIncluded: params.includePrivateRepositoryDetails,
    privateCacheDetailsIncluded: params.includePrivateCacheDetails,
    redactedPrivateRepositories: params.includePrivateRepositoryDetails
      ? 0
      : params.repositories.filter((repo) => repo.isPrivate).length,
    redactedRepositoryContributions:
      params.repositoryContributions - params.visibleRepositoryContributions,
    redactedOptionalMetrics:
      Object.keys(params.cache.contributorStats).filter(
        (repoId) => !params.metricCacheKeys.has(repoId)
      ).length +
      Object.keys(params.cache.traffic).filter(
        (repoId) => !params.metricCacheKeys.has(repoId)
      ).length,
  };
}

function addPrivacyWarnings(
  collectionStatus: CollectionStatus,
  privacy: PrivacyReport
): CollectionStatus {
  const privacyWarnings: string[] = [];
  if (privacy.redactedPrivateRepositories > 0) {
    privacyWarnings.push(
      `Private repository details redacted: ${privacy.redactedPrivateRepositories} repositories`
    );
  }
  if (privacy.redactedRepositoryContributions > 0) {
    privacyWarnings.push(
      `Private repository contribution details redacted: ${privacy.redactedRepositoryContributions} repositories`
    );
  }

  return {
    ...collectionStatus,
    warnings: [...collectionStatus.warnings, ...privacyWarnings],
  };
}
