import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DifflerConfig } from "../../src/config.js";
import { analyzeTemplate, collectProfiles, UnifiedEngine } from "../../src/engine/index.js";
import { GitHubClient } from "../../src/github/client.js";
import { runStatsCollection } from "../../src/stats/index.js";
import { cacheRepository, createEmptyStableCache, writeStableCache } from "../../src/stats/cache.js";
import { createConfig, createOutput, createRepository, NOW } from "./fixtures.js";

vi.mock("../../src/stats/index.js", () => ({ runStatsCollection: vi.fn() }));

let directory: string;
let config: DifflerConfig;
const alice = { username: "alice", token: "alice-token" };
const bob = { username: "bob", token: "bob-token" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("STATS_OUTPUT_PATH", "");
  vi.stubEnv("STATS_CACHE_PATH", "");
  vi.stubEnv("STATS_VOLATILE_CACHE_PATH", "");
  vi.stubEnv("STATS_INCLUDE_TRAFFIC", "");
  vi.stubEnv("STATS_INCLUDE_REST_REPO_STATS", "");
  vi.stubEnv("STATS_BACKFILL_MODE", "");
  directory = mkdtempSync(join(tmpdir(), "diffler-unified-"));
  config = createConfig();
  config.statsAction.cachePath = join(directory, "stable.json");
  config.statsAction.volatileCachePath = join(directory, "volatile.json");
  config.statsAction.outputPath = join(directory, "output.json");
  config.cache.directory = directory;
  vi.mocked(runStatsCollection).mockReset().mockResolvedValue(createOutput());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  rmSync(directory, { recursive: true, force: true });
});

it("isolates stable, volatile, and output paths for each account without changing configured paths", async () => {
  const engine = new UnifiedEngine();
  const before = structuredClone(config);
  vi.mocked(runStatsCollection).mockResolvedValueOnce(createOutput()).mockResolvedValueOnce(createOutput("bob"));

  await engine.collect(analyzeTemplate("{{ stats }}"), config, alice);
  await engine.collect(analyzeTemplate("{{ stats }}"), config, bob);

  const first = vi.mocked(runStatsCollection).mock.calls[0][0];
  const second = vi.mocked(runStatsCollection).mock.calls[1][0];
  expect(first.cachePath).not.toBe(second.cachePath);
  expect(first.volatileCachePath).not.toBe(second.volatileCachePath);
  expect(first.outputPath).not.toBe(second.outputPath);
  expect(first.cachePath).toContain(join(directory, "profiles", "alice-"));
  expect(first.outputPath).not.toBe(config.statsAction.outputPath);
  expect(basename(first.cachePath)).toBe("stable.json");
  expect(basename(first.volatileCachePath)).toBe("volatile.json");
  expect(basename(first.outputPath)).toBe("output.json");
  expect(config).toEqual(before);
});

it("uses different cache namespaces for the same login on different GitHub hosts", async () => {
  const engine = new UnifiedEngine();
  await engine.collect(analyzeTemplate("{{ profile }}"), config, alice);
  config.github.apiUrl = "https://github.example.com/api/v3";

  await engine.collect(analyzeTemplate("{{ profile }}"), config, alice);

  expect(vi.mocked(runStatsCollection).mock.calls[0][0].cachePath)
    .not.toBe(vi.mocked(runStatsCollection).mock.calls[1][0].cachePath);
});

it("canonical traffic planning enables only the requested optional metric", async () => {
  await new UnifiedEngine().collect(analyzeTemplate("{{ stats.repoMetrics.traffic.repoViews }}"), config, alice);

  expect(vi.mocked(runStatsCollection).mock.calls[0][0]).toMatchObject({
    includeTraffic: true, includeRestRepoStats: false, backfillMode: "resume",
  });
});

it("canonical contributor planning enables only the requested optional metric", async () => {
  await new UnifiedEngine().collect(analyzeTemplate("{{ stats.repoMetrics.contributorStats.linesAdded }}"), config, alice);

  expect(vi.mocked(runStatsCollection).mock.calls[0][0]).toMatchObject({
    includeTraffic: false, includeRestRepoStats: true, backfillMode: "resume",
  });
});

it("core-only planning disables optional backfill", async () => {
  await new UnifiedEngine().collect(analyzeTemplate("{{ stats.repoMetrics.starCount }}"), config, alice);

  expect(vi.mocked(runStatsCollection).mock.calls[0][0]).toMatchObject({
    includeTraffic: false, includeRestRepoStats: false, backfillMode: "off",
  });
});

it("does not override an explicit configuration disabling optional traffic", async () => {
  config.statsAction.includeTraffic = false;

  await new UnifiedEngine().collect(analyzeTemplate("{{ traffic }}"), config, alice);

  expect(vi.mocked(runStatsCollection).mock.calls[0][0]).toMatchObject({ includeTraffic: false, backfillMode: "off" });
});

it("refreshes organizations when the configured extras TTL expires", async () => {
  config.cache.ttl = 2;
  const engine = new UnifiedEngine();
  const plan = analyzeTemplate("{{ organizations }}");
  const rest = vi.spyOn(GitHubClient.prototype, "restGet")
    .mockResolvedValueOnce([{ id: 1, login: "old" }])
    .mockResolvedValueOnce([{ id: 2, login: "new" }]);
  await engine.collect(plan, config, alice);
  vi.setSystemTime(NOW + 1000);
  const cached = await engine.collect(plan, config, alice);
  vi.setSystemTime(NOW + 2000);

  const refreshed = await engine.collect(plan, config, alice);

  expect(cached.extras.organizations?.[0].login).toBe("old");
  expect(refreshed.extras.organizations?.[0].login).toBe("new");
  expect(rest).toHaveBeenCalledTimes(2);
});

it("refreshes gists when the configured extras TTL expires", async () => {
  config.cache.ttl = 1;
  const engine = new UnifiedEngine();
  const plan = analyzeTemplate("{{ gists }}");
  const rest = vi.spyOn(GitHubClient.prototype, "restGet")
    .mockResolvedValueOnce([{ id: "old", files: { "a.md": {} } }])
    .mockResolvedValueOnce([{ id: "new", files: { "b.md": {} } }]);
  await engine.collect(plan, config, alice);
  vi.setSystemTime(NOW + 1000);

  const result = await engine.collect(plan, config, alice);

  expect(result.extras.gists?.[0]).toMatchObject({ id: "new", files: ["b.md"] });
  expect(rest).toHaveBeenCalledTimes(2);
});

it("does not read or write extras caches when caching is disabled", async () => {
  config.cache.enabled = false;
  const engine = new UnifiedEngine();
  const plan = analyzeTemplate("{{ organizations }}");
  const rest = vi.spyOn(GitHubClient.prototype, "restGet").mockResolvedValue([]);

  await engine.collect(plan, config, alice);
  await engine.collect(plan, config, alice);

  expect(rest).toHaveBeenCalledTimes(2);
  expect(existsSync(join(directory, "extras"))).toBe(false);
});

it("treats a zero extras TTL as no cache reuse", async () => {
  config.cache.ttl = 0;
  const engine = new UnifiedEngine();
  const plan = analyzeTemplate("{{ gists }}");
  const rest = vi.spyOn(GitHubClient.prototype, "restGet").mockResolvedValue([]);

  await engine.collect(plan, config, alice);
  await engine.collect(plan, config, alice);

  expect(rest).toHaveBeenCalledTimes(2);
});

it("does not share extras between accounts", async () => {
  const engine = new UnifiedEngine();
  const plan = analyzeTemplate("{{ organizations }}");
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice"))
    .mockResolvedValueOnce(createOutput("bob"))
    .mockResolvedValueOnce(createOutput("alice"));
  const rest = vi.spyOn(GitHubClient.prototype, "restGet")
    .mockResolvedValueOnce([{ login: "alice-org" }])
    .mockResolvedValueOnce([{ login: "bob-org" }]);
  await engine.collect(plan, config, alice);
  const second = await engine.collect(plan, config, bob);

  const firstAgain = await engine.collect(plan, config, alice);

  expect(second.extras.organizations?.[0].login).toBe("bob-org");
  expect(firstAgain.extras.organizations?.[0].login).toBe("alice-org");
  expect(rest).toHaveBeenCalledTimes(2);
});

it("refreshes malformed extras cache data instead of trusting it", async () => {
  const engine = new UnifiedEngine();
  const plan = analyzeTemplate("{{ organizations }}");
  const rest = vi.spyOn(GitHubClient.prototype, "restGet")
    .mockResolvedValueOnce([{ login: "old" }])
    .mockResolvedValueOnce([{ login: "new" }]);
  await engine.collect(plan, config, alice);
  const namespace = readdirSync(join(directory, "extras"))[0];
  writeFileSync(join(directory, "extras", namespace, "orgs.json"), JSON.stringify({ fetchedAt: NOW, data: [null] }));

  const result = await engine.collect(plan, config, alice);

  expect(result.extras.organizations?.[0].login).toBe("new");
  expect(rest).toHaveBeenCalledTimes(2);
});

it("fails clearly on malformed extra responses instead of returning a successful empty list", async () => {
  vi.spyOn(GitHubClient.prototype, "restGet").mockResolvedValue({ message: "not an array" });

  await expect(new UnifiedEngine().collect(analyzeTemplate("{{ gists }}"), config, alice))
    .rejects.toThrow("Invalid gists response for alice");
});

it("rejects a collected account that does not match the requested profile", async () => {
  vi.mocked(runStatsCollection).mockResolvedValueOnce(createOutput("bob"));

  await expect(new UnifiedEngine().collect(analyzeTemplate("{{ profile }}"), config, alice))
    .rejects.toThrow("Collected GitHub account bob does not match requested profile alice");
});

it("reuses per-account metric caches through the owner-aware collector handoff", async () => {
  config.github.usernames = ["alice", "bob"];
  const repository = createRepository();
  const cache = createEmptyStableCache(NOW);
  cache.ownerLogin = "alice";
  cacheRepository(cache, repository);
  cache.traffic[repository.id] = { count: 12, uniques: 3, days: [], fetchedAt: NOW, status: "fresh" };
  const first = createOutput("alice", { cache, repositories: [repository] });
  vi.mocked(runStatsCollection)
    .mockImplementationOnce(async (statsConfig) => {
      writeStableCache(statsConfig.cachePath, cache);
      return first;
    })
    .mockResolvedValueOnce(createOutput("bob"));

  const { output } = await collectProfiles(analyzeTemplate("{{ traffic }}"), config);

  expect(output.repoMetrics.traffic.repoViews).toBe(12);
  expect(output.repoMetrics.traffic.reposCompleted).toBe(1);
  expect(output.collectionStatus.complete).toBe(true);
});

it("does not reuse metric cache data with a different account owner", async () => {
  config.github.usernames = ["alice", "bob"];
  const repository = createRepository();
  const cache = createEmptyStableCache(NOW);
  cache.ownerLogin = "wrong-account";
  cacheRepository(cache, repository);
  cache.traffic[repository.id] = { count: 12, uniques: 3, days: [], fetchedAt: NOW, status: "fresh" };
  const first = createOutput("alice", { cache, repositories: [repository] });
  vi.mocked(runStatsCollection)
    .mockImplementationOnce(async (statsConfig) => {
      writeStableCache(statsConfig.cachePath, cache);
      return first;
    })
    .mockResolvedValueOnce(createOutput("bob"));

  const { output } = await collectProfiles(analyzeTemplate("{{ traffic }}"), config);

  expect(output.repoMetrics.traffic.repoViews).toBe(0);
  expect(output.collectionStatus.complete).toBe(false);
});

it("fails explicitly instead of treating truncated extra pagination as complete", async () => {
  const page = Array.from({ length: 100 }, (_, index) => ({ id: String(index) }));
  const rest = vi.spyOn(GitHubClient.prototype, "restGet").mockResolvedValue(page);

  await expect(new UnifiedEngine().collect(analyzeTemplate("{{ gists }}"), config, alice))
    .rejects.toThrow("Incomplete gists collection for alice: pagination limit exceeded");

  expect(rest).toHaveBeenCalledTimes(10);
  expect(existsSync(join(directory, "extras"))).toBe(false);
});
