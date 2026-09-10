import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  ActivityStats,
  CollectionStatus,
  GitHubStatsOutput,
  RepositoryRecord,
} from "@lukasparke/diffler-schemas";
import { mergePackageMetrics, mergeProfileContributions, mergeRepositories } from "@lukasparke/diffler-schemas";
import type { DifflerConfig } from "../config.js";
import { buildStatsActionConfig, getProfiles } from "../config.js";
import { createEmptyStableCache, hasRepositoryKey, readStableCache } from "../stats/cache.js";
import { buildOutput } from "../stats/output.js";
import type { ContributorStatsSummary, StableCache, StatsActionConfig } from "../stats/types.js";
import type { CollectionPlan } from "./plan.js";
import { buildProfileStatsConfig } from "./paths.js";
import { UnifiedEngine, type CollectionExtras } from "./unified.js";

export async function collectProfiles(
  plan: CollectionPlan,
  config: DifflerConfig
): Promise<{ output: GitHubStatsOutput; extras: CollectionExtras }> {
  const profiles = getProfiles(config.github);
  if (profiles.length === 0) throw new Error("No GitHub profiles configured for collection");
  const usernames = profiles.map((profile) => profile.username.trim().toLowerCase());
  if (usernames.some((username) => !username)) {
    throw new Error("GitHub profile usernames must not be empty");
  }
  if (new Set(usernames).size !== usernames.length) {
    throw new Error("Duplicate GitHub profiles cannot be aggregated");
  }

  const engine = new UnifiedEngine();
  const outputs: GitHubStatsOutput[] = [];
  const extrasList: CollectionExtras[] = [];
  const caches: StableCache[] = [];
  for (const profile of profiles) {
    try {
      const { output, extras } = await engine.collect(plan, config, profile);
      outputs.push(output);
      extrasList.push(extras);
      if (profiles.length > 1) {
        const statsConfig = buildProfileStatsConfig(plan, config, profile);
        caches.push(readStableCache(statsConfig.cachePath, output.profile.login));
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Failed to collect GitHub profile ${profile.username}: ${message}`, { cause });
    }
  }

  const statsConfig = buildStatsActionConfig(config);
  const output = outputs.length === 1
    ? outputs[0]
    : aggregateOutputs(outputs, caches, statsConfig);
  const extras = outputs.length === 1
    ? extrasList[0]
    : mergeExtras(outputs, extrasList);

  // Only the final result belongs at the advertised path; account snapshots are isolated.
  mkdirSync(dirname(statsConfig.outputPath), { recursive: true });
  writeFileSync(statsConfig.outputPath, JSON.stringify(output, null, 2));
  return { output, extras };
}

function aggregateOutputs(
  outputs: GitHubStatsOutput[],
  caches: StableCache[],
  config: StatsActionConfig
): GitHubStatsOutput {
  const repositories = mergeRepositories(outputs.flatMap((output) => output.repositories))
    .map((repository) => ({ ...repository, viewerPermission: null }));
  const repositoriesById = new Map(repositories.map((repository) => [repository.id, repository]));
  const collection = mergeProfileContributions(
    outputs.map((output) => output.profileContributions), new Date().toISOString().slice(0, 10)
  );
  const repositoryContributions = collection.repositoryContributions.map((summary) => {
    const repository = repositoriesById.get(summary.repositoryId);
    return repository
      ? { ...summary, nameWithOwner: repository.nameWithOwner, owner: repository.owner }
      : summary;
  }).sort((a, b) => a.nameWithOwner.localeCompare(b.nameWithOwner));
  const missingYears = uniqueSorted(outputs.flatMap(
    (output) => output.profileContributions.completeness.missingYears
  ));
  const emptyCalendars = outputs.filter((output) => !output.profileContributions.contributionCalendar.weeks
    .some((week) => week.contributionDays.length > 0));
  const contributionsComplete = emptyCalendars.length === 0 && missingYears.length === 0 && outputs.every(
    (output) => output.profileContributions.completeness.complete
  );
  const { cache, warnings: metricWarnings, repositoryCoverageComplete } = aggregateMetricCaches(outputs, caches);
  const redactedRepositories = sum(outputs, (output) => output.privacy.redactedPrivateRepositories);
  const contributedIds = new Set([
    ...repositoryContributions.map((summary) => summary.repositoryId),
    ...repositories.filter((repository) =>
      repository.sources.includes("contributed") || repository.sources.includes("profile-contribution")
    ).map((repository) => repository.id),
  ]);
  const activity: ActivityStats = {
    totalPullRequests: sum(outputs, (output) => output.activity.totalPullRequests),
    openIssues: sum(outputs, (output) => output.activity.openIssues),
    closedIssues: sum(outputs, (output) => output.activity.closedIssues),
    repositoriesContributedTo: contributedIds.size,
    discussionsStarted: sum(outputs, (output) => output.activity.discussionsStarted),
    discussionsAnswered: sum(outputs, (output) => output.activity.discussionsAnswered),
    starsGiven: sum(outputs, (output) => output.activity.starsGiven),
  };
  const warnings = [
    `Profiles aggregated: ${outputs.map((output) => output.profile.login).join(", ")}. Display identity and follower counts belong to ${outputs[0].profile.login}.`,
    "Repository metadata is deduplicated by ID; repositoriesContributedTo counts known repository IDs. Contribution and other activity counts are summed per account, not distinct events or targets.",
    "Cache/backfill work counters count per-account tasks. Cache paths and rate-limit snapshots are per-account and are not represented on the aggregate.",
    ...emptyCalendars.map((output) =>
      `[${output.profile.login}] No contribution calendar days available; contribution aggregation is incomplete.`
    ),
    ...metricWarnings,
  ];
  if (redactedRepositories > 0) {
    warnings.push(
      "Private repository aggregates cannot be deduplicated after redaction. Repository statistics cover visible repositories only; privacy redaction counts describe records across accounts, not distinct repositories."
    );
  }
  const coreComplete = contributionsComplete && repositoryCoverageComplete && redactedRepositories === 0 &&
    outputs.every((output) => output.collectionStatus.coreComplete);
  const errors = outputs.flatMap((output) => output.collectionStatus.errors.map(
    (error) => `[${output.profile.login}] ${error}`
  ));
  const startedAt = Math.min(...outputs.map((output) => output.collectionStatus.startedAt));
  const finishedAt = Date.now();
  const status: CollectionStatus = {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    coreComplete,
    complete: coreComplete && metricWarnings.length === 0 && errors.length === 0 &&
      cache.backfill.pending.length === 0 && Object.keys(cache.backfill.failures).length === 0 &&
      outputs.every((output) => output.collectionStatus.complete &&
        output.packageMetrics.complete &&
        output.collectionStatus.backfill.pending === 0 &&
        output.collectionStatus.backfill.failedThisRun === 0 &&
        output.repoMetrics.contributorStats.reposPending === 0 &&
        output.repoMetrics.contributorStats.reposFailed === 0 &&
        output.repoMetrics.traffic.reposPending === 0 &&
        output.repoMetrics.traffic.reposFailed === 0),
    cache: {
      stablePath: "",
      volatilePath: "",
      contributionYearsFromCache: sum(outputs, (output) => output.collectionStatus.cache.contributionYearsFromCache),
      contributionYearsFetched: sum(outputs, (output) => output.collectionStatus.cache.contributionYearsFetched),
      repositoriesFromCache: sum(outputs, (output) => output.collectionStatus.cache.repositoriesFromCache),
      repositoriesFetched: sum(outputs, (output) => output.collectionStatus.cache.repositoriesFetched),
    },
    backfill: {
      enabled: outputs.some((output) => output.collectionStatus.backfill.enabled),
      completedThisRun: sum(outputs, (output) => output.collectionStatus.backfill.completedThisRun),
      pending: Math.max(
        cache.backfill.pending.length,
        sum(outputs, (output) => output.collectionStatus.backfill.pending)
      ),
      failedThisRun: sum(outputs, (output) => output.collectionStatus.backfill.failedThisRun),
      skippedThisRun: sum(outputs, (output) => output.collectionStatus.backfill.skippedThisRun),
    },
    rateLimit: { graphql: null, rest: null },
    warnings: [
      ...warnings,
      ...outputs.flatMap((output) => output.collectionStatus.warnings.map(
        (warning) => `[${output.profile.login}] ${warning}`
      )),
    ],
    errors,
  };
  const aggregate = buildOutput({
    profile: { ...outputs[0].profile },
    activity,
    contributions: {
      collection,
      repositories,
      repositoryContributions,
      yearsFetched: uniqueSorted(outputs.flatMap((output) => output.profileContributions.completeness.yearsFetched)),
      yearsFromCache: uniqueSorted(outputs.flatMap((output) => output.profileContributions.completeness.yearsFromCache)),
      missingYears,
    },
    repositories,
    cache,
    config,
    collectionStatus: status,
    fetchedAt: finishedAt,
    packageMetrics: mergePackageMetrics(outputs.map((output) => output.packageMetrics)),
  });

  return {
    ...aggregate,
    profileContributions: {
      ...aggregate.profileContributions,
      completeness: { ...aggregate.profileContributions.completeness, complete: contributionsComplete },
    },
    privacy: {
      ...aggregate.privacy,
      redactedPrivateRepositories: aggregate.privacy.redactedPrivateRepositories + redactedRepositories,
      redactedRepositoryContributions: aggregate.privacy.redactedRepositoryContributions +
        sum(outputs, (output) => output.privacy.redactedRepositoryContributions),
      redactedOptionalMetrics: aggregate.privacy.redactedOptionalMetrics +
        sum(outputs, (output) => output.privacy.redactedOptionalMetrics),
    },
  };
}

function aggregateMetricCaches(
  outputs: GitHubStatsOutput[],
  caches: StableCache[]
): { cache: StableCache; warnings: string[]; repositoryCoverageComplete: boolean } {
  const aggregate = createEmptyStableCache();
  const warnings: string[] = [];
  const contributorsByRepository = new Map<string, ContributorStatsSummary>();
  const trafficByRepository = new Map<string, StableCache["traffic"][string]>();
  const pending = new Map<string, StableCache["backfill"]["pending"][number]>();
  const missingContributors = new Map<string, RepositoryRecord>();
  const missingTraffic = new Map<string, RepositoryRecord>();
  let repositoryCoverageComplete = true;
  for (const [index, output] of outputs.entries()) {
    const cache = caches[index];
    const visibleIds = new Set(output.repositories.map((repository) => repository.id));
    const contributors = Object.entries(cache.contributorStats).filter(([id]) => visibleIds.has(id));
    const traffic = Object.entries(cache.traffic).filter(([id]) => visibleIds.has(id));
    const contributorTotals = output.repoMetrics.contributorStats;
    const trafficTotals = output.repoMetrics.traffic;
    if (contributors.some(([, stats]) => !isMetricComplete(stats.status)) ||
      traffic.some(([, stats]) => !isMetricComplete(stats.status))) {
      warnings.push(`[${output.profile.login}] Optional repository metric cache contains incomplete results.`);
    }
    const contributorsInconsistent =
      contributors.reduce((total, [, stats]) => total + stats.additions, 0) !== contributorTotals.linesAdded ||
      contributors.reduce((total, [, stats]) => total + stats.deletions, 0) !== contributorTotals.linesDeleted ||
      contributors.reduce((total, [, stats]) => total + stats.commits, 0) !== contributorTotals.totalCommits ||
      contributors.filter(([, stats]) => isMetricComplete(stats.status)).length !== contributorTotals.reposCompleted;
    const trafficInconsistent =
      traffic.reduce((total, [, stats]) => total + stats.count, 0) !== trafficTotals.repoViews ||
      traffic.reduce((total, [, stats]) => total + stats.uniques, 0) !== trafficTotals.repoViewUniques ||
      traffic.filter(([, stats]) => isMetricComplete(stats.status)).length !== trafficTotals.reposCompleted;
    if (contributorsInconsistent || trafficInconsistent) {
      warnings.push(
        `[${output.profile.login}] Per-repository optional metric cache is unavailable or inconsistent; aggregate optional metrics include only identifiable cached values.`
      );
      if (visibleIds.size === 0) repositoryCoverageComplete = false;
      for (const repository of output.repositories) {
        if (contributorsInconsistent) missingContributors.set(repository.id, repository);
        if (trafficInconsistent) missingTraffic.set(repository.id, repository);
      }
    }
    for (const [id, stats] of contributors) {
      const current = contributorsByRepository.get(id);
      contributorsByRepository.set(id, current ? {
        ...stats,
        additions: current.additions + stats.additions,
        deletions: current.deletions + stats.deletions,
        commits: current.commits + stats.commits,
        fetchedAt: Math.min(current.fetchedAt, stats.fetchedAt),
        status: !isMetricComplete(current.status) ? current.status : stats.status,
      } : { ...stats });
    }
    for (const [id, stats] of traffic) {
      const current = trafficByRepository.get(id);
      const candidate: StableCache["traffic"][string] = trafficInconsistent
        ? { ...stats, status: "pending" }
        : { ...stats };
      if (!current ||
        (isMetricComplete(candidate.status) && !isMetricComplete(current.status)) ||
        (isMetricComplete(candidate.status) === isMetricComplete(current.status) && candidate.fetchedAt >= current.fetchedAt)) {
        trafficByRepository.set(id, candidate);
      }
    }
    for (const item of cache.backfill.pending) {
      if (visibleIds.has(item.repoId)) pending.set(`${item.type}:${item.repoId}`, { ...item });
    }
    for (const failure of Object.values(cache.backfill.failures)) {
      if (!hasRepositoryKey(failure.key, visibleIds)) continue;
      const [type, id] = failure.key.split(":");
      const key = `${type}:${id}`;
      const current = aggregate.backfill.failures[key];
      if (!current || failure.failedAt >= current.failedAt) {
        aggregate.backfill.failures[key] = { ...failure, key };
      }
    }
  }
  for (const [id, repository] of missingContributors) {
    const stats = contributorsByRepository.get(id);
    if (stats && isMetricComplete(stats.status)) stats.status = "pending";
    const key = `contributors:${id}`;
    pending.set(key, { key, type: "contributors", repoId: id, nameWithOwner: repository.nameWithOwner, priority: 0, reason: "Per-account metric coverage must be recollected" });
  }
  for (const [id, repository] of missingTraffic) {
    const stats = trafficByRepository.get(id);
    if (stats && isMetricComplete(stats.status)) continue;
    const key = `traffic:${id}`;
    pending.set(key, { key, type: "traffic", repoId: id, nameWithOwner: repository.nameWithOwner, priority: 0, reason: "Repository traffic coverage must be recollected" });
  }
  aggregate.contributorStats = Object.fromEntries(contributorsByRepository);
  aggregate.traffic = Object.fromEntries(trafficByRepository);
  aggregate.backfill.pending = [...pending.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { cache: aggregate, warnings, repositoryCoverageComplete };
}

function isMetricComplete(status: ContributorStatsSummary["status"]): boolean {
  return status === "fresh" || status === "cached";
}

function mergeExtras(outputs: GitHubStatsOutput[], extras: CollectionExtras[]): CollectionExtras {
  return {
    profiles: outputs.flatMap((output, index) => extras[index].profiles ?? [output.profile]),
    ...(extras.some((extra) => extra.organizations !== undefined)
      ? { organizations: uniqueRecords(extras.flatMap((extra) => extra.organizations ?? []), "login") }
      : {}),
    ...(extras.some((extra) => extra.gists !== undefined)
      ? { gists: uniqueRecords(extras.flatMap((extra) => extra.gists ?? []), "html_url") }
      : {}),
    ...(extras.every((extra) => extra.pinnedRepositories !== undefined)
      ? { pinnedRepositories: mergeRepositories(extras.flatMap((extra) => extra.pinnedRepositories ?? [])) }
      : {}),
  };
}

function uniqueRecords(records: Record<string, unknown>[], fallback: string): Record<string, unknown>[] {
  const seen = new Set<string | number>();
  return records.filter((record) => {
    const key = record.id === "" || record.id === null || record.id === undefined
      ? record[fallback]
      : record.id;
    if ((typeof key !== "string" && typeof key !== "number") || key === "") return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sum(outputs: GitHubStatsOutput[], value: (output: GitHubStatsOutput) => number): number {
  return outputs.reduce((total, output) => total + value(output), 0);
}
