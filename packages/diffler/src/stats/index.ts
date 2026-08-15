import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  CollectionStatus,
  GitHubStatsOutput,
  StatsActionConfig,
} from "./types.js";
import {
  formatBytes,
  formatNumber,
  aggregateLanguages,
  calculateContributionStats,
  calculateComputedStats,
} from "./aggregate.js";
import {
  readStableCache,
  readVolatileCache,
  cacheRepository,
  writeStableCache,
  writeVolatileCache,
} from "./cache.js";
import {
  buildBackfillQueue,
  collectContributionYears,
  collectProfile,
  collectRepositoryUniverse,
  mergeRepositories,
  processBackfillQueue,
} from "./github.js";
import { buildOutput } from "./output.js";
import { RequestScheduler } from "./scheduler.js";
import type { GitHubClient } from "../github/client.js";
import { collectPackageStats } from "../packages/index.js";

export {
  formatBytes,
  formatNumber,
  aggregateLanguages,
  calculateContributionStats,
  calculateComputedStats,
};

export type { GitHubStatsOutput, StatsActionConfig, CollectionStatus };

export async function runStatsCollection(
  config: StatsActionConfig,
  client: GitHubClient
): Promise<GitHubStatsOutput> {
  const startedAt = Date.now();
  const scheduler = new RequestScheduler(config, startedAt);

  const stableCache = readStableCache(config.cachePath);
  const volatileCache = readVolatileCache(config.volatileCachePath);
  const warnings: string[] = [];
  const errors: string[] = [];
  console.log("Collecting configured package registry stats");
  const packageMetricsPromise = collectPackageStats(config.packageSources);

  console.log("Collecting viewer profile and activity counts");
  const { profile, activity } = await collectProfile(client, scheduler);

  console.log("Collecting contribution years with cache reuse");
  const contributions = await collectContributionYears(
    client,
    scheduler,
    stableCache,
    profile.createdAt,
    config.includePrivateCacheDetails,
    config.graphqlConcurrency
  );
  if (
    contributions.collection.contributionCalendar.weeks.length === 0 &&
    contributions.missingYears.length > 0
  ) {
    throw new Error(
      `Unable to collect any contribution calendar data; missing years: ${contributions.missingYears.join(", ")}`
    );
  }
  if (contributions.missingYears.length > 0) {
    warnings.push(
      `Contribution data is incomplete for years: ${contributions.missingYears.join(", ")}`
    );
  }

  console.log("Collecting owned, affiliated, and contributed repositories");
  const repositoryUniverse = await collectRepositoryUniverse(
    client,
    scheduler,
    stableCache,
    config.includePrivateCacheDetails,
    profile.login
  );
  let repositories = mergeRepositories([
    ...repositoryUniverse.repositories,
    ...contributions.repositories,
  ]);

  for (const repository of repositories) {
    cacheRepository(stableCache, repository, config.includePrivateCacheDetails);
  }

  console.log("Building resumable optional repository metric queue");
  stableCache.backfill.pending = buildBackfillQueue(
    repositories,
    stableCache,
    config
  );
  const backfillResult = await processBackfillQueue(
    client,
    scheduler,
    stableCache,
    volatileCache,
    repositories,
    stableCache.backfill.pending,
    profile.login,
    config
  );

  repositories = mergeRepositories(
    [
      ...Object.values(stableCache.repositories).map((entry) => entry.repository),
      ...repositories,
      ...contributions.repositories,
    ]
  );
  const packageMetrics = await packageMetricsPromise;
  warnings.push(...packageMetrics.warnings);

  const finishedAt = Date.now();
  const schedulerState = scheduler.state();
  const collectionStatus: CollectionStatus = {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    coreComplete: contributions.missingYears.length === 0,
    complete:
      contributions.missingYears.length === 0 &&
      stableCache.backfill.pending.length === 0 &&
      backfillResult.failed === 0,
    cache: {
      stablePath: config.cachePath,
      volatilePath: config.volatileCachePath,
      contributionYearsFromCache: contributions.yearsFromCache.length,
      contributionYearsFetched: contributions.yearsFetched.length,
      repositoriesFromCache: repositoryUniverse.repositoriesFromCache,
      repositoriesFetched: repositoryUniverse.repositoriesFetched,
    },
    backfill: {
      enabled: config.backfillMode !== "off",
      completedThisRun: backfillResult.completed,
      pending: backfillResult.pending.length,
      failedThisRun: backfillResult.failed,
      skippedThisRun: backfillResult.skipped,
    },
    rateLimit: {
      graphql: schedulerState.graphqlRateLimit,
      rest: schedulerState.restRateLimit,
    },
    warnings: [...warnings, ...schedulerState.warnings],
    errors,
  };

  const output = buildOutput({
    profile,
    activity,
    contributions,
    repositories,
    cache: stableCache,
    config,
    collectionStatus,
    fetchedAt: finishedAt,
    packageMetrics,
  });

  writeJsonOutput(config.outputPath, output);
  writeStableCache(
    config.cachePath,
    stableCache,
    config.includePrivateCacheDetails,
    config.includePrivateRepositoryMetrics
  );
  writeVolatileCache(config.volatileCachePath, volatileCache);

  console.log(
    `Collection complete in ${((finishedAt - startedAt) / 1000).toFixed(2)}s`
  );

  return output;
}

function writeJsonOutput(path: string, value: unknown): void {
  const dir = dirname(path);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}
