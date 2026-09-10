import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../../src/github/client.js";
import { createEmptyStableCache, createEmptyVolatileCache } from "../../src/stats/cache.js";
import { runStatsCollection } from "../../src/stats/index.js";
import {
  NOW,
  cachedYear,
  contributionCollection,
  contributorStats,
  enrichment,
  githubConfig,
  graphqlResponse,
  profile,
  queueContributionResponses,
  queueDiscoveryResponses,
  queueProfileResponse,
  rawRepository,
  repository,
  statsConfig,
  traffic,
} from "./fixtures.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe("runStatsCollection", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const files = new Map<string, string>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error("Unexpected HTTP request"));
    files.clear();
    vi.mocked(existsSync).mockImplementation((path) => files.has(String(path)));
    vi.mocked(readFileSync).mockImplementation((path) => files.get(String(path)) ?? "");
    vi.mocked(writeFileSync).mockImplementation((path, data) => {
      files.set(String(path), String(data));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("targets the configured account for profile, contribution, and repository queries", async () => {
    queueProfileResponse(fetchMock);
    queueContributionResponses(fetchMock, contributionCollection("2026", 7));
    queueDiscoveryResponses(fetchMock);

    const output = await runStatsCollection(statsConfig, new GitHubClient(githubConfig));

    expect(output.profile.login).toBe("alice");
    expect(output.profileContributions.totalContributions).toBe(7);
    const requests = fetchMock.mock.calls.map(([, options]): unknown =>
      JSON.parse(String(options?.body))
    );
    expect(requests).toEqual(Array.from({ length: 5 }, () => expect.objectContaining({
      query: expect.stringContaining("user(login: $login)"),
      variables: expect.objectContaining({ login: "alice" }),
    })));
  });

  it("uses viewer only when no target account is configured", async () => {
    queueProfileResponse(fetchMock, profile({ login: "bob" }));
    queueContributionResponses(fetchMock);
    queueDiscoveryResponses(fetchMock);

    const output = await runStatsCollection(
      statsConfig,
      new GitHubClient({ ...githubConfig, username: null })
    );

    expect(output.profile.login).toBe("bob");
    const requests = fetchMock.mock.calls.map(([, options]): unknown =>
      JSON.parse(String(options?.body))
    );
    expect(requests).toEqual(Array.from({ length: 5 }, () => expect.objectContaining({
      query: expect.stringMatching(/viewer\s*\{/),
    })));
    expect(JSON.stringify(requests)).not.toContain("user(login:");
    expect(JSON.parse(files.get(statsConfig.cachePath) ?? "null")).toMatchObject({
      ownerLogin: "bob",
    });
  });

  it("does not fall back to the token owner when the configured user is missing", async () => {
    fetchMock.mockResolvedValueOnce(graphqlResponse({ viewer: null }));

    await expect(runStatsCollection(statsConfig, new GitHubClient(githubConfig)))
      .rejects.toThrow("Configured GitHub account was not found");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(files.size).toBe(0);
  });

  it("rejects a profile response for a different account before reading its caches", async () => {
    queueProfileResponse(fetchMock, profile({ login: "bob" }));

    await expect(runStatsCollection(statsConfig, new GitHubClient(githubConfig)))
      .rejects.toThrow("GitHub profile does not match the configured account");

    expect(existsSync).not.toHaveBeenCalled();
    expect(readFileSync).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
  });

  it.each([
    { label: "another account's", ownerLogin: "bob" },
    { label: "ownerless", ownerLogin: undefined },
  ])("resets $label history, contributor metrics, and validators", async ({ ownerLogin }) => {
    const cache = createEmptyStableCache();
    const repo = repository();
    cache.contributionYears["2024"] = cachedYear();
    cache.repositories[repo.id] = { fetchedAt: NOW.getTime(), repository: repo };
    cache.repositories["R_OLD"] = {
      fetchedAt: NOW.getTime(),
      repository: repository({ id: "R_OLD", nameWithOwner: "bob/old" }),
    };
    cache.contributorStats[repo.id] = contributorStats({ additions: 999 });
    cache.traffic[repo.id] = traffic({ count: 999, fetchedAt: NOW.getTime() });
    const volatile = createEmptyVolatileCache();
    volatile.restEtags[`contributors:${repo.id}:current-sha`] = {
      etag: '"other-account"', updatedAt: NOW.getTime(),
    };
    files.set(statsConfig.cachePath, JSON.stringify({ ...cache, ownerLogin }));
    files.set(statsConfig.volatileCachePath, JSON.stringify({ ...volatile, ownerLogin }));
    queueProfileResponse(fetchMock, profile({ createdAt: "2024-01-01T00:00:00.000Z" }));
    queueContributionResponses(fetchMock, contributionCollection("2024", 1));
    queueContributionResponses(fetchMock, contributionCollection("2025", 2));
    queueContributionResponses(fetchMock, contributionCollection("2026", 3));
    queueDiscoveryResponses(fetchMock, [rawRepository()]);
    fetchMock
      .mockResolvedValueOnce(graphqlResponse({ nodes: [rawRepository()] }))
      .mockResolvedValueOnce(Response.json([
        { author: { login: "bob" }, weeks: [{ a: 999, d: 99, c: 99 }] },
        { author: { login: "ALICE" }, weeks: [{ a: 7, d: 2, c: 3 }] },
      ], { headers: { etag: '"alice-stats"' } }))
      .mockResolvedValueOnce(Response.json({ count: 4, uniques: 2, views: [] }));

    const output = await runStatsCollection(statsConfig, new GitHubClient(githubConfig));

    expect(output.profileContributions.totalContributions).toBe(6);
    expect(output.repoMetrics.contributorStats.linesAdded).toBe(7);
    expect(output.repoMetrics.traffic.repoViews).toBe(4);
    expect(output.repositories.map((entry) => entry.id)).toEqual([repo.id]);
    expect(output.collectionStatus.cache.contributionYearsFromCache).toBe(0);
    expect(fetchMock).toHaveBeenNthCalledWith(11,
      "https://api.github.com/repos/alice/shared/stats/contributors",
      expect.objectContaining({ headers: expect.not.objectContaining({
        "If-None-Match": expect.anything(),
      }) })
    );
    expect(JSON.parse(files.get(statsConfig.cachePath) ?? "null")).toMatchObject({
      ownerLogin: "alice",
    });
    expect(JSON.parse(files.get(statsConfig.volatileCachePath) ?? "null")).toMatchObject({
      ownerLogin: "alice",
    });
  });

  it("redacts private repository details and metrics by default", async () => {
    const privateRepo = rawRepository({
      id: "R_SECRET", name: "secret", nameWithOwner: "alice/secret", isPrivate: true,
    });
    queueProfileResponse(fetchMock);
    queueContributionResponses(fetchMock);
    queueDiscoveryResponses(fetchMock, [privateRepo]);
    fetchMock.mockResolvedValueOnce(graphqlResponse({ nodes: [privateRepo] }));

    const output = await runStatsCollection(statsConfig, new GitHubClient(githubConfig));

    expect(output.repoMetrics.repoStats).toMatchObject({ totalRepos: 0, publicRepos: 0, privateRepos: 0 });
    expect(output.repositories).toEqual([]);
    expect(output.repoMetrics.topLanguages).toEqual([]);
    expect(output.privacy.redactedPrivateRepositories).toBe(1);
    expect(files.get(statsConfig.outputPath)).not.toContain("alice/secret");
    expect(files.get(statsConfig.cachePath)).not.toContain("R_SECRET");
  });

  it("can include live private output details while keeping the persisted cache public-only", async () => {
    const privateRepo = rawRepository({
      id: "R_SECRET", name: "secret", nameWithOwner: "alice/secret", isPrivate: true,
    });
    queueProfileResponse(fetchMock);
    queueContributionResponses(fetchMock);
    queueDiscoveryResponses(fetchMock, [privateRepo]);
    fetchMock.mockResolvedValueOnce(graphqlResponse({ nodes: [privateRepo] }));

    const output = await runStatsCollection(
      { ...statsConfig, includePrivateRepositoryDetails: true, backfillMode: "off" },
      new GitHubClient(githubConfig)
    );

    expect(output.repositories).toEqual([expect.objectContaining({ id: "R_SECRET" })]);
    expect(output.repoMetrics.repoStats.privateRepos).toBe(1);
    expect(files.get(statsConfig.cachePath)).not.toContain("R_SECRET");
  });

  it("evicts a cached public repository when live discovery says it is now private", async () => {
    const cache = createEmptyStableCache();
    const repo = repository({ metadataFetchedAt: NOW.getTime() });
    cache.repositories[repo.id] = { fetchedAt: NOW.getTime(), repository: repo };
    cache.contributionYears["2024"] = cachedYear({
      repositories: [repo],
      repositoryContributions: [{
        repositoryId: repo.id, nameWithOwner: repo.nameWithOwner, owner: repo.owner,
        counts: { ...repo.contributionCounts, commits: 9 },
      }],
    });
    cache.contributorStats[repo.id] = contributorStats();
    cache.traffic[repo.id] = traffic();
    cache.backfill.pending = [{
      key: `contributors:${repo.id}:current-sha`, type: "contributors", repoId: repo.id,
      nameWithOwner: repo.nameWithOwner, priority: 1, reason: "previously public",
    }];
    files.set(statsConfig.cachePath, JSON.stringify({ ...cache, ownerLogin: "alice" }));
    const volatile = createEmptyVolatileCache();
    volatile.restEtags[`contributors:${repo.id}:current-sha`] = {
      etag: '"previously-public"', updatedAt: NOW.getTime(),
    };
    files.set(statsConfig.volatileCachePath, JSON.stringify({ ...volatile, ownerLogin: "alice" }));
    const privateRepo = rawRepository({ isPrivate: true, visibility: "PRIVATE" });
    queueProfileResponse(fetchMock, profile({ createdAt: "2024-01-01T00:00:00.000Z" }));
    queueContributionResponses(fetchMock, contributionCollection("2025"));
    queueContributionResponses(fetchMock);
    queueDiscoveryResponses(fetchMock, [privateRepo]);
    fetchMock.mockResolvedValueOnce(graphqlResponse({ nodes: [privateRepo] }));

    const output = await runStatsCollection(statsConfig, new GitHubClient(githubConfig));

    expect(output.repositories).toEqual([]);
    expect(output.repoMetrics.repoStats).toMatchObject({ totalRepos: 0, publicRepos: 0, privateRepos: 0 });
    expect(output.repoMetrics.contributorStats.linesAdded).toBe(0);
    expect(output.profileContributions.repositoryContributions).toEqual([]);
    expect(output.collectionStatus.backfill.pending).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(files.get(statsConfig.cachePath)).not.toContain(repo.id);
    expect(files.get(statsConfig.volatileCachePath)).not.toContain(repo.id);
    expect(files.get(statsConfig.outputPath)).not.toContain(repo.nameWithOwner);
  });

  it.each([false, true])("does not publish inaccessible cached repositories (private output: %s)", async (includePrivateRepositoryDetails) => {
    const cache = createEmptyStableCache();
    const repo = repository();
    cache.repositories[repo.id] = { fetchedAt: NOW.getTime(), repository: repo };
    cache.contributionYears["2024"] = cachedYear({
      repositories: [repo],
      repositoryContributions: [{
        repositoryId: repo.id, nameWithOwner: repo.nameWithOwner, owner: repo.owner,
        counts: { ...repo.contributionCounts, commits: 9 },
      }],
    });
    files.set(statsConfig.cachePath, JSON.stringify({ ...cache, ownerLogin: "ALICE" }));
    queueProfileResponse(fetchMock, profile({ createdAt: "2024-01-01T00:00:00.000Z" }));
    queueContributionResponses(fetchMock, contributionCollection("2025"));
    queueContributionResponses(fetchMock);
    queueDiscoveryResponses(fetchMock);
    fetchMock.mockResolvedValueOnce(Response.json({
      data: { nodes: [null] },
      errors: [{ type: "NOT_FOUND", path: ["nodes", 0], message: "Repository is no longer accessible" }],
    }));

    const output = await runStatsCollection(
      { ...statsConfig, includePrivateRepositoryDetails }, new GitHubClient(githubConfig)
    );

    expect(output.profileContributions.totalContributions).toBe(100);
    expect(output.repositories).toEqual([]);
    expect(output.profileContributions.repositoryContributions).toEqual([]);
    expect(output.collectionStatus.cache.contributionYearsFromCache).toBe(1);
    expect(files.get(statsConfig.outputPath)).not.toContain(repo.nameWithOwner);
    expect(files.get(statsConfig.cachePath)).not.toContain(repo.nameWithOwner);
  });

  it("reports incomplete enrichment without discarding a successfully collected calendar", async () => {
    queueProfileResponse(fetchMock);
    fetchMock
      .mockResolvedValueOnce(graphqlResponse({ viewer: {
        contributionsCollection: contributionCollection("2026", 7),
      } }))
      .mockResolvedValueOnce(Response.json({ errors: [{ message: "Enrichment unavailable" }] }));
    queueDiscoveryResponses(fetchMock);

    const output = await runStatsCollection(statsConfig, new GitHubClient(githubConfig));

    expect(output.profileContributions.totalContributions).toBe(7);
    expect(output.collectionStatus).toMatchObject({ coreComplete: true, complete: false });
    expect(output.collectionStatus.warnings).toContain(
      "Repository contribution enrichment is incomplete for years: 2026; it will be retried"
    );
  });

  it("uses current public names rather than historical private names in repository summaries", async () => {
    const cache = createEmptyStableCache();
    const oldRepo = repository({ isPrivate: true, nameWithOwner: "alice/old-secret" });
    cache.contributionYears["2024"] = cachedYear({
      repositories: [oldRepo],
      repositoryContributions: [{
        repositoryId: oldRepo.id, nameWithOwner: oldRepo.nameWithOwner, owner: oldRepo.owner,
        counts: { ...oldRepo.contributionCounts, commits: 7 },
      }],
    });
    files.set(statsConfig.cachePath, JSON.stringify({ ...cache, ownerLogin: "alice" }));
    queueProfileResponse(fetchMock, profile({ createdAt: "2024-01-01T00:00:00.000Z" }));
    queueContributionResponses(fetchMock, contributionCollection("2025"));
    queueContributionResponses(fetchMock);
    queueDiscoveryResponses(fetchMock, [rawRepository()]);
    fetchMock.mockResolvedValueOnce(graphqlResponse({ nodes: [rawRepository()] }));

    const output = await runStatsCollection(
      { ...statsConfig, backfillMode: "off" }, new GitHubClient(githubConfig)
    );

    expect(output.profileContributions.repositoryContributions).toEqual([
      expect.objectContaining({ nameWithOwner: "alice/shared", counts: expect.objectContaining({ commits: 7 }) }),
    ]);
    expect(files.get(statsConfig.outputPath)).not.toContain("alice/old-secret");
    expect(files.get(statsConfig.cachePath)).not.toContain("alice/old-secret");
  });

  it("publishes known values and incomplete status while HTTP 202 metrics remain pending", async () => {
    const cache = createEmptyStableCache();
    const repo = repository();
    cache.repositories[repo.id] = { fetchedAt: NOW.getTime(), repository: repo };
    cache.contributorStats[repo.id] = contributorStats();
    cache.traffic[repo.id] = traffic();
    files.set(statsConfig.cachePath, JSON.stringify({ ...cache, ownerLogin: "alice" }));
    queueProfileResponse(fetchMock);
    queueContributionResponses(fetchMock);
    queueDiscoveryResponses(fetchMock, [rawRepository()]);
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const collection = runStatsCollection(
      { ...statsConfig, backfillMode: "refresh" }, new GitHubClient(githubConfig)
    );
    await vi.runAllTimersAsync();
    const output = await collection;

    expect(output.repoMetrics.contributorStats.linesAdded).toBe(70);
    expect(output.repoMetrics.contributorStats.linesDeleted).toBe(20);
    expect(output.repoMetrics.traffic.repoViews).toBe(12);
    expect(output.collectionStatus).toMatchObject({
      complete: false, coreComplete: true, backfill: { pending: 2, completedThisRun: 0 },
    });
    expect(output.repoMetrics.contributorStats).toMatchObject({ reposCompleted: 0, reposPending: 1 });
    expect(output.repoMetrics.traffic).toMatchObject({ reposCompleted: 0, reposPending: 1 });
    expect(JSON.parse(files.get(statsConfig.cachePath) ?? "null")).toMatchObject({
      backfill: { pending: [expect.objectContaining({ type: "contributors" }), expect.objectContaining({ type: "traffic" })] },
    });
  });

  it("preserves repository contribution counts when historical years are reused", async () => {
    const repo = rawRepository();
    queueProfileResponse(fetchMock, profile({ createdAt: "2024-01-01T00:00:00.000Z" }));
    queueContributionResponses(fetchMock, contributionCollection("2024", 7), enrichment([
      { repository: repo, contributions: { totalCount: 7 } },
    ]));
    queueContributionResponses(fetchMock, contributionCollection("2025", 2), enrichment([
      { repository: repo, contributions: { totalCount: 2 } },
    ]));
    queueContributionResponses(fetchMock, contributionCollection("2026", 3), enrichment([
      { repository: repo, contributions: { totalCount: 3 } },
    ]));
    queueDiscoveryResponses(fetchMock, [repo]);
    const config = { ...statsConfig, backfillMode: "off" as const };

    const first = await runStatsCollection(config, new GitHubClient(githubConfig));

    queueProfileResponse(fetchMock, profile({ createdAt: "2024-01-01T00:00:00.000Z" }));
    queueContributionResponses(fetchMock, contributionCollection("2025", 2), enrichment([
      { repository: repo, contributions: { totalCount: 2 } },
    ]));
    queueContributionResponses(fetchMock, contributionCollection("2026", 3), enrichment([
      { repository: repo, contributions: { totalCount: 3 } },
    ]));
    queueDiscoveryResponses(fetchMock, [repo]);

    const second = await runStatsCollection(config, new GitHubClient(githubConfig));

    expect(first.repositories[0].contributionCounts.commits).toBe(12);
    expect(second.repositories[0].contributionCounts.commits).toBe(12);
    expect(second.profileContributions.repositoryContributions[0].counts.commits).toBe(12);
    expect(second.collectionStatus.cache.contributionYearsFromCache).toBe(1);
    expect(second.profileContributions.totalContributions).toBe(first.profileContributions.totalContributions);
  });

  it("does not attribute private metric failures to a public repository with a shared ID prefix", async () => {
    const cache = createEmptyStableCache();
    const repo = repository();
    cache.repositories[repo.id] = { fetchedAt: NOW.getTime(), repository: repo };
    cache.backfill.failures["contributors:R_SHARED_PRIVATE:current-sha"] = {
      key: "contributors:R_SHARED_PRIVATE:current-sha", failedAt: NOW.getTime(), attempts: 1,
      message: "Metrics unavailable",
    };
    files.set(statsConfig.cachePath, JSON.stringify({ ...cache, ownerLogin: "alice" }));
    queueProfileResponse(fetchMock);
    queueContributionResponses(fetchMock);
    queueDiscoveryResponses(fetchMock, [rawRepository()]);

    const output = await runStatsCollection(
      { ...statsConfig, backfillMode: "off" }, new GitHubClient(githubConfig)
    );

    expect(output.repoMetrics.contributorStats.reposFailed).toBe(0);
    expect(files.get(statsConfig.cachePath)).not.toContain("R_SHARED_PRIVATE");
  });
});
