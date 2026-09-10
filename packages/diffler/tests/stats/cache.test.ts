import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheRepository, createEmptyStableCache, mergeBackfillQueue, sanitizeStableCache } from "../../src/stats/cache.js";
import type { BackfillItem } from "../../src/stats/types.js";
import { NOW, cachedYear, contributorStats, repository, traffic } from "./fixtures.js";

describe("cache privacy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes private backfill records whose repository ID shares a public ID prefix", () => {
    const cache = createEmptyStableCache();
    const publicRepo = repository();
    const privateRepo = repository({
      id: "R_SHARED_PRIVATE", nameWithOwner: "alice/secret", isPrivate: true,
    });
    cache.repositories[publicRepo.id] = { fetchedAt: NOW.getTime(), repository: publicRepo };
    cache.repositories[privateRepo.id] = { fetchedAt: NOW.getTime(), repository: privateRepo };
    cache.contributorStats[privateRepo.id] = contributorStats();
    cache.traffic[privateRepo.id] = traffic();
    cache.backfill.pending = [{
      key: "contributors:R_SHARED_PRIVATE:current-sha", type: "contributors",
      repoId: privateRepo.id, nameWithOwner: privateRepo.nameWithOwner, priority: 1, reason: "pending",
    }];
    cache.backfill.completed["contributors:R_SHARED_PRIVATE:current-sha"] = NOW.getTime();
    cache.backfill.failures["traffic:R_SHARED_PRIVATE"] = {
      key: "traffic:R_SHARED_PRIVATE", failedAt: NOW.getTime(), attempts: 1, message: "unavailable",
    };

    const sanitized = sanitizeStableCache(cache, false);

    expect(JSON.stringify(sanitized)).not.toContain(privateRepo.id);
    expect(sanitized.backfill).toEqual({ pending: [], completed: {}, failures: {} });
    expect(sanitized.repositories[publicRepo.id]).toBeDefined();
    expect(cache.contributorStats[privateRepo.id]).toEqual(contributorStats());
  });

  it("does not persist historical private names when the same repository is now public", () => {
    const cache = createEmptyStableCache();
    const publicRepo = repository();
    const privateRepo = repository({ isPrivate: true, nameWithOwner: "alice/old-secret" });
    cache.repositories[publicRepo.id] = { fetchedAt: NOW.getTime(), repository: publicRepo };
    cache.contributionYears["2024"] = cachedYear({
      repositories: [privateRepo],
      repositoryContributions: [{
        repositoryId: privateRepo.id, nameWithOwner: privateRepo.nameWithOwner, owner: privateRepo.owner,
        counts: privateRepo.contributionCounts,
      }],
    });

    const sanitized = sanitizeStableCache(cache, false);

    expect(JSON.stringify(sanitized)).not.toContain("alice/old-secret");
    expect(sanitized.contributionYears["2024"].repositoryContributions).toEqual([]);
    expect(sanitized.contributionYears["2024"].data.totalCommitContributions).toBe(100);
  });

  it("does not let an older historical snapshot overwrite newer private metadata", () => {
    const cache = createEmptyStableCache();
    const privateRepo = repository({ isPrivate: true, metadataFetchedAt: NOW.getTime() });
    cacheRepository(cache, privateRepo, true);

    cacheRepository(cache, repository(), true);

    expect(cache.repositories[privateRepo.id].repository.isPrivate).toBe(true);
  });

  it("refreshes pending repository names while retaining their scheduling priority", () => {
    const previous: BackfillItem = {
      key: "traffic:R_SHARED", type: "traffic", repoId: "R_SHARED",
      nameWithOwner: "alice/old-secret", priority: 1, reason: "pending",
    };
    const current = { ...previous, nameWithOwner: "alice/shared", priority: 10 };

    const queue = mergeBackfillQueue([previous], [current]);

    expect(queue).toEqual([{ ...current, priority: 1 }]);
  });
});
