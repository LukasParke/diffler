import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../../src/github/client.js";
import { createEmptyStableCache, createEmptyVolatileCache } from "../../src/stats/cache.js";
import { buildBackfillQueue, processBackfillQueue } from "../../src/stats/github.js";
import { RequestScheduler } from "../../src/stats/scheduler.js";
import type { StableCache, StatsActionConfig, VolatileCache } from "../../src/stats/types.js";
import { NOW, contributorStats, githubConfig, repository, statsConfig, traffic } from "./fixtures.js";

function collectMetrics(
  cache: StableCache,
  volatile: VolatileCache,
  config: StatsActionConfig
) {
  const repositories = [repository()];
  return processBackfillQueue(
    new GitHubClient(githubConfig),
    new RequestScheduler(config),
    cache,
    volatile,
    repositories,
    buildBackfillQueue(repositories, cache, config),
    "alice",
    config
  );
}

describe("repository metric HTTP responses", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error("Unexpected HTTP request"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves contributor values on a returned HTTP 304", async () => {
    const cache = createEmptyStableCache();
    const volatile = createEmptyVolatileCache();
    cache.contributorStats["R_SHARED"] = contributorStats();
    volatile.restEtags["contributors:R_SHARED:current-sha"] = {
      etag: '"contributors"', updatedAt: NOW.getTime(),
    };
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));

    const result = await collectMetrics(cache, volatile, {
      ...statsConfig, includeTraffic: false, backfillMode: "refresh",
    });

    expect(cache.contributorStats["R_SHARED"]).toEqual(contributorStats({
      status: "cached", fetchedAt: NOW.getTime(),
    }));
    expect(result).toMatchObject({ completed: 1, failed: 0, pending: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/alice/shared/stats/contributors",
      expect.objectContaining({ headers: expect.objectContaining({
        "If-None-Match": '"contributors"',
      }) })
    );
  });

  it("preserves traffic totals and daily history on a returned HTTP 304", async () => {
    const cache = createEmptyStableCache();
    const volatile = createEmptyVolatileCache();
    cache.traffic["R_SHARED"] = traffic();
    volatile.restEtags["traffic:R_SHARED"] = {
      lastModified: "Sun, 31 May 2026 12:00:00 GMT", updatedAt: NOW.getTime(),
    };
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));

    const result = await collectMetrics(cache, volatile, {
      ...statsConfig, includeRestRepoStats: false,
    });

    expect(cache.traffic["R_SHARED"]).toEqual(traffic({
      status: "cached", fetchedAt: NOW.getTime(),
    }));
    expect(result).toMatchObject({ completed: 1, failed: 0, pending: [] });
  });

  it("keeps HTTP 202 contributor work resumable without replacing known values or validators", async () => {
    const cache = createEmptyStableCache();
    const volatile = createEmptyVolatileCache();
    cache.contributorStats["R_SHARED"] = contributorStats();
    cache.backfill.completed["contributors:R_SHARED:current-sha"] = NOW.getTime() - 86400000;
    volatile.restEtags["contributors:R_SHARED:current-sha"] = {
      etag: '"known-body"', updatedAt: NOW.getTime(),
    };
    fetchMock.mockResolvedValue(new Response(null, {
      status: 202, headers: { etag: '"pending-body"' },
    }));

    const collection = collectMetrics(cache, volatile, {
      ...statsConfig, includeTraffic: false, backfillMode: "refresh",
    });
    await vi.runAllTimersAsync();
    const result = await collection;

    expect(cache.contributorStats["R_SHARED"]).toMatchObject(contributorStats({ status: "pending" }));
    expect(result).toMatchObject({ completed: 0, failed: 0, pending: [
      expect.objectContaining({ key: "contributors:R_SHARED:current-sha" }),
    ] });
    expect(cache.backfill.completed).toEqual({});
    expect(volatile.restEtags["contributors:R_SHARED:current-sha"].etag).toBe('"known-body"');

    fetchMock.mockResolvedValueOnce(Response.json([
      { author: { login: "alice" }, weeks: [{ a: 80, d: 25, c: 4 }] },
    ]));
    const resumed = await collectMetrics(cache, volatile, { ...statsConfig, includeTraffic: false });

    expect(resumed).toMatchObject({ completed: 1, pending: [] });
    expect(cache.contributorStats["R_SHARED"]).toMatchObject({
      additions: 80, deletions: 25, commits: 4, status: "fresh",
    });
  });

  it("keeps HTTP 202 traffic work pending and preserves the last successful values", async () => {
    const cache = createEmptyStableCache();
    const volatile = createEmptyVolatileCache();
    cache.traffic["R_SHARED"] = traffic();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));

    const result = await collectMetrics(cache, volatile, {
      ...statsConfig, includeRestRepoStats: false,
    });

    expect(cache.traffic["R_SHARED"]).toMatchObject(traffic({ status: "pending" }));
    expect(result).toMatchObject({ completed: 0, pending: [
      expect.objectContaining({ key: "traffic:R_SHARED" }),
    ] });
    expect(cache.backfill.completed).toEqual({});
  });

  it("does not complete contributor work when GitHub has never returned a computed value", async () => {
    const cache = createEmptyStableCache();
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const collection = collectMetrics(cache, createEmptyVolatileCache(), {
      ...statsConfig, includeTraffic: false,
    });
    await vi.runAllTimersAsync();
    const result = await collection;

    expect(result).toMatchObject({ completed: 0, failed: 0 });
    expect(result.pending).toHaveLength(1);
    expect(cache.contributorStats["R_SHARED"].status).toBe("pending");
    expect(cache.backfill.completed).toEqual({});
  });

  it("does not send an orphaned validator when its contributor metrics are missing", async () => {
    const cache = createEmptyStableCache();
    const volatile = createEmptyVolatileCache();
    volatile.restEtags["contributors:R_SHARED:current-sha"] = {
      etag: '"orphaned"', updatedAt: NOW.getTime(),
    };
    fetchMock.mockResolvedValueOnce(Response.json([
      { author: { login: "alice" }, weeks: [{ a: 7, d: 2, c: 3 }] },
    ]));

    await collectMetrics(cache, volatile, { ...statsConfig, includeTraffic: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/alice/shared/stats/contributors",
      expect.objectContaining({ headers: expect.not.objectContaining({
        "If-None-Match": expect.anything(),
      }) })
    );
    expect(cache.contributorStats["R_SHARED"].additions).toBe(7);
  });

  it.each([
    { key: "contributors:R_SHARED:current-sha", includeTraffic: false, includeRestRepoStats: true },
    { key: "traffic:R_SHARED", includeTraffic: true, includeRestRepoStats: false },
  ])("does not complete an orphaned HTTP 304 for $key", async ({ key, includeTraffic, includeRestRepoStats }) => {
    const cache = createEmptyStableCache();
    const volatile = createEmptyVolatileCache();
    volatile.restEtags[key] = { etag: '"orphaned"', updatedAt: NOW.getTime() };
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));

    const result = await collectMetrics(cache, volatile, {
      ...statsConfig, includeTraffic, includeRestRepoStats,
    });

    expect(result).toMatchObject({ completed: 0, failed: 1 });
    expect(result.pending).toHaveLength(1);
    expect(cache.contributorStats).toEqual({});
    expect(cache.traffic).toEqual({});
    expect(volatile.restEtags).toEqual({});
  });

  it("retains the old branch's known values while a new branch's contributor stats are pending", async () => {
    const cache = createEmptyStableCache();
    const volatile = createEmptyVolatileCache();
    cache.contributorStats["R_SHARED"] = contributorStats({ defaultBranchOid: "old-sha" });
    volatile.restEtags["contributors:R_SHARED:current-sha"] = {
      etag: '"unmatched-body"', updatedAt: NOW.getTime(),
    };
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const collection = collectMetrics(cache, volatile, { ...statsConfig, includeTraffic: false });
    await vi.runAllTimersAsync();
    await collection;

    expect(cache.contributorStats["R_SHARED"]).toMatchObject(contributorStats({
      defaultBranchOid: "old-sha", status: "pending",
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(1,
      "https://api.github.com/repos/alice/shared/stats/contributors",
      expect.objectContaining({ headers: expect.not.objectContaining({
        "If-None-Match": expect.anything(),
      }) })
    );
  });

  it("does not turn an unexpected empty successful response into zero contributor metrics", async () => {
    const cache = createEmptyStableCache();
    cache.contributorStats["R_SHARED"] = contributorStats();
    fetchMock.mockResolvedValueOnce(Response.json(null));

    const result = await collectMetrics(cache, createEmptyVolatileCache(), {
      ...statsConfig, includeTraffic: false, backfillMode: "refresh",
    });

    expect(cache.contributorStats["R_SHARED"]).toEqual(contributorStats());
    expect(result).toMatchObject({ completed: 0, failed: 1 });
  });

  it("resumes a throttled refresh even when its last known metrics match the branch", async () => {
    const cache = createEmptyStableCache();
    const volatile = createEmptyVolatileCache();
    cache.contributorStats["R_SHARED"] = contributorStats();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429, headers: {
      "Retry-After": "600",
    } }));

    const deferred = await collectMetrics(cache, volatile, {
      ...statsConfig, includeTraffic: false, backfillMode: "refresh", maxRuntimeSeconds: 1,
    });

    expect(deferred).toMatchObject({ completed: 0, skipped: 1 });
    expect(deferred.pending).toHaveLength(1);
    expect(cache.contributorStats["R_SHARED"]).toEqual(contributorStats());

    fetchMock.mockResolvedValueOnce(Response.json([
      { author: { login: "alice" }, weeks: [{ a: 80, d: 25, c: 4 }] },
    ]));
    const resumed = await collectMetrics(cache, volatile, { ...statsConfig, includeTraffic: false });

    expect(resumed).toMatchObject({ completed: 1, pending: [] });
    expect(cache.contributorStats["R_SHARED"].additions).toBe(80);
  });
});
