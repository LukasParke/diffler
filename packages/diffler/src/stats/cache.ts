import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import {
  type BackfillFailure,
  type BackfillItem,
  CACHE_SCHEMA_VERSION,
  type CachedContributionYear,
  type RepositoryRecord,
  type StableCache,
  type VolatileCache,
} from "./types.js";

export function createEmptyStableCache(now = Date.now()): StableCache {
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    updatedAt: now,
    contributionYears: {},
    repositories: {},
    contributorStats: {},
    traffic: {},
    backfill: {
      pending: [],
      completed: {},
      failures: {},
    },
  };
}

export function createEmptyVolatileCache(now = Date.now()): VolatileCache {
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    updatedAt: now,
    restEtags: {},
  };
}

export function readStableCache(path: string, ownerLogin?: string): StableCache {
  return isolateCacheOwner(
    readJsonFile(path, createEmptyStableCache, isStableCache),
    ownerLogin,
    createEmptyStableCache
  );
}

export function readVolatileCache(path: string, ownerLogin?: string): VolatileCache {
  return isolateCacheOwner(
    readJsonFile(path, createEmptyVolatileCache, isVolatileCache),
    ownerLogin,
    createEmptyVolatileCache
  );
}

export function writeStableCache(
  path: string,
  cache: StableCache,
  includePrivateDetails = false,
  includePrivateMetrics = false
): void {
  writeJsonFile(path, {
    ...sanitizeStableCache(cache, includePrivateDetails, includePrivateMetrics),
    updatedAt: Date.now(),
  });
}

export function writeVolatileCache(
  path: string,
  cache: VolatileCache,
  repositoryIds?: ReadonlySet<string>
): void {
  writeJsonFile(path, {
    ...cache,
    restEtags: repositoryIds
      ? filterBackfillRecord(cache.restEtags, repositoryIds)
      : cache.restEtags,
    updatedAt: Date.now(),
  });
}

export function cacheContributionYear(
  cache: StableCache,
  year: CachedContributionYear,
  includePrivateDetails = false
): void {
  cache.contributionYears[year.year] = sanitizeContributionYear(
    year,
    includePrivateDetails
  );
}

export function cacheRepository(
  cache: StableCache,
  repository: RepositoryRecord,
  includePrivateDetails = false
): void {
  const current = cache.repositories[repository.id];
  if (current && current.repository.metadataFetchedAt > repository.metadataFetchedAt) return;

  if (repository.isPrivate && !includePrivateDetails) {
    delete cache.repositories[repository.id];
    return;
  }

  cache.repositories[repository.id] = {
    fetchedAt: Date.now(),
    repository: metadataOnlyRepository(repository),
  };
}

export function sanitizeStableCache(
  cache: StableCache,
  includePrivateDetails: boolean,
  includePrivateMetrics = false
): StableCache {
  if (includePrivateDetails) return cache;

  const repositories = Object.fromEntries(
    Object.entries(cache.repositories).filter(
      ([, entry]) => !entry.repository.isPrivate
    )
  );
  const publicRepositoryIds = new Set(Object.keys(repositories));
  const metricCacheIds = includePrivateMetrics
    ? new Set([
        ...publicRepositoryIds,
        ...Object.keys(cache.contributorStats).filter(isPrivateMetricCacheKey),
        ...Object.keys(cache.traffic).filter(isPrivateMetricCacheKey),
      ])
    : publicRepositoryIds;

  return {
    ...cache,
    repositories,
    contributionYears: Object.fromEntries(
      Object.entries(cache.contributionYears).map(([year, contributionYear]) => [
        year,
        sanitizeContributionYear(contributionYear, false, publicRepositoryIds),
      ])
    ),
    contributorStats: filterRecordByPublicRepoId(
      cache.contributorStats,
      metricCacheIds
    ),
    traffic: filterRecordByPublicRepoId(cache.traffic, metricCacheIds),
    backfill: {
      pending: cache.backfill.pending.filter((item) =>
        publicRepositoryIds.has(item.repoId)
      ),
      completed: filterBackfillRecord(cache.backfill.completed, publicRepositoryIds),
      failures: filterBackfillRecord(cache.backfill.failures, publicRepositoryIds),
    },
  };
}

export function repositoryMetricCacheKey(
  repository: RepositoryRecord,
  includePrivateDetails: boolean
): string {
  if (!repository.isPrivate || includePrivateDetails) return repository.id;
  return `private:${hashPrivateMetricValue(repository.id)}`;
}

export function repositoryMetricVersion(
  repository: RepositoryRecord,
  includePrivateDetails: boolean
): string | null {
  if (
    !repository.defaultBranchOid ||
    !repository.isPrivate ||
    includePrivateDetails
  ) {
    return repository.defaultBranchOid;
  }
  return `private:${hashPrivateMetricValue(repository.defaultBranchOid)}`;
}

function isPrivateMetricCacheKey(key: string): boolean {
  return key.startsWith("private:");
}

function hashPrivateMetricValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function shouldReuseContributionYear(
  cached: CachedContributionYear | undefined,
  year: number,
  currentYear: number
): cached is CachedContributionYear {
  if (!cached) return false;
  if (year >= currentYear - 1) return false;
  return cached.immutable && cached.enrichmentComplete !== false;
}

export function mergeBackfillQueue(
  existing: BackfillItem[],
  next: BackfillItem[]
): BackfillItem[] {
  const byKey = new Map<string, BackfillItem>();
  for (const item of existing) byKey.set(item.key, item);
  for (const item of next) {
    const current = byKey.get(item.key);
    byKey.set(item.key, {
      ...item,
      priority: Math.min(current?.priority ?? item.priority, item.priority),
    });
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.priority - b.priority || a.key.localeCompare(b.key)
  );
}

export function recordBackfillFailure(
  failures: Record<string, BackfillFailure>,
  item: BackfillItem,
  message: string
): void {
  const current = failures[item.key];
  failures[item.key] = {
    key: item.key,
    failedAt: Date.now(),
    attempts: (current?.attempts || 0) + 1,
    message,
  };
}

function readJsonFile<T>(
  path: string,
  createEmpty: () => T,
  validate: (value: unknown) => value is T
): T {
  if (!existsSync(path)) return createEmpty();

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (validate(parsed)) return parsed;
  } catch {
    return createEmpty();
  }

  return createEmpty();
}

function isolateCacheOwner<T extends { ownerLogin?: string }>(
  cache: T,
  ownerLogin: string | undefined,
  createEmpty: () => T
): T {
  if (ownerLogin === undefined) return cache;
  const owner = ownerLogin.toLowerCase();
  return {
    ...(cache.ownerLogin?.toLowerCase() === owner ? cache : createEmpty()),
    ownerLogin: owner,
  };
}

function writeJsonFile(path: string, value: unknown): void {
  const dir = dirname(path);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function isStableCache(value: unknown): value is StableCache {
  if (!isRecord(value)) return false;
  return (
    value["schemaVersion"] === CACHE_SCHEMA_VERSION &&
    (value["ownerLogin"] === undefined || typeof value["ownerLogin"] === "string") &&
    isRecord(value["contributionYears"]) &&
    isRecord(value["repositories"]) &&
    isRecord(value["contributorStats"]) &&
    isRecord(value["traffic"]) &&
    isRecord(value["backfill"])
  );
}

function isVolatileCache(value: unknown): value is VolatileCache {
  if (!isRecord(value)) return false;
  return (
    value["schemaVersion"] === CACHE_SCHEMA_VERSION &&
    (value["ownerLogin"] === undefined || typeof value["ownerLogin"] === "string") &&
    isRecord(value["restEtags"])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeContributionYear(
  year: CachedContributionYear,
  includePrivateDetails: boolean,
  publicRepositoryIds = new Set(
    year.repositories.filter((repository) => !repository.isPrivate).map((repo) => repo.id)
  )
): CachedContributionYear {
  if (includePrivateDetails) return year;

  const repositories = year.repositories
    .filter((repository) => !repository.isPrivate && publicRepositoryIds.has(repository.id))
    .map(metadataOnlyRepository);
  const visibleRepositoryIds = new Set(repositories.map((repository) => repository.id));
  return {
    ...year,
    repositories,
    repositoryContributions: year.repositoryContributions.filter((summary) =>
      visibleRepositoryIds.has(summary.repositoryId)
    ),
  };
}

export function metadataOnlyRepository(repository: RepositoryRecord): RepositoryRecord {
  return {
    ...repository,
    contributionCounts: {
      commits: 0,
      issues: 0,
      pullRequests: 0,
      pullRequestReviews: 0,
      repositoryCreations: 0,
    },
  };
}

function filterRecordByPublicRepoId<T>(
  record: Record<string, T>,
  publicRepositoryIds: Set<string>
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([repoId]) => publicRepositoryIds.has(repoId))
  );
}

function filterBackfillRecord<T>(
  record: Record<string, T>,
  publicRepositoryIds: ReadonlySet<string>
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) =>
      hasRepositoryKey(key, publicRepositoryIds)
    )
  );
}

export function hasRepositoryKey(key: string, repositoryIds: ReadonlySet<string>): boolean {
  const [type, repositoryId] = key.split(":");
  return (type === "contributors" || type === "traffic") && repositoryIds.has(repositoryId);
}
