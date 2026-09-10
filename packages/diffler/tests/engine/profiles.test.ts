import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { githubStatsOutputSchema, type GitHubStatsOutput } from "@lukasparke/diffler-schemas";
import type { DifflerConfig } from "../../src/config.js";
import { analyzeTemplate, collectProfiles } from "../../src/engine/index.js";
import { GitHubClient } from "../../src/github/client.js";
import { createEmptyStableCache, readStableCache } from "../../src/stats/cache.js";
import { runStatsCollection } from "../../src/stats/index.js";
import { createCollection, createConfig, createOutput, createRepository, NOW } from "./fixtures.js";

vi.mock("../../src/stats/index.js", () => ({ runStatsCollection: vi.fn() }));
vi.mock("../../src/stats/cache.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/stats/cache.js")>(),
  readStableCache: vi.fn(),
}));

let directory: string;
let config: DifflerConfig;
const plan = analyzeTemplate("{{ stats }}");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("STATS_OUTPUT_PATH", "");
  vi.stubEnv("STATS_CACHE_PATH", "");
  vi.stubEnv("STATS_VOLATILE_CACHE_PATH", "");
  directory = mkdtempSync(join(tmpdir(), "diffler-profiles-"));
  config = createConfig();
  config.statsAction.outputPath = join(directory, "stats.json");
  config.statsAction.cachePath = join(directory, "stable.json");
  config.statsAction.volatileCachePath = join(directory, "volatile.json");
  config.cache.directory = directory;
  vi.mocked(runStatsCollection).mockReset();
  vi.mocked(readStableCache).mockReset().mockReturnValue(createEmptyStableCache(NOW));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  rmSync(directory, { recursive: true, force: true });
});

it("preserves and publishes the single-profile output unchanged", async () => {
  const single = createOutput();
  vi.mocked(runStatsCollection).mockResolvedValueOnce(single);

  const result = await collectProfiles(plan, config);

  expect(result.output).toBe(single);
  expect(result.extras.profiles).toEqual([single.profile]);
  expect(JSON.parse(readFileSync(config.statsAction.outputPath, "utf8"))).toEqual(single);
});

it("includes the second account in a two-profile aggregate", async () => {
  config.github.usernames = ["alice", "bob"];
  const first = createOutput("alice", {}, createCollection([
    { date: "2026-01-06", contributionCount: 1 },
    { date: "2026-01-07", contributionCount: 0 },
  ]));
  const second = createOutput("bob", {}, createCollection([
    { date: "2026-01-06", contributionCount: 0 },
    { date: "2026-01-07", contributionCount: 2 },
  ]));
  vi.mocked(runStatsCollection).mockResolvedValueOnce(first).mockResolvedValueOnce(second);

  const { output } = await collectProfiles(plan, config);

  expect(output.profileContributions.totalContributions).toBe(3);
  expect(output.profileContributions.totalCommitContributions).toBe(3);
  expect(output.profileContributions.stats).toMatchObject({
    currentStreak: 2, longestStreak: 2, averagePerDay: 1.5,
    monthlyBreakdown: [{ month: "2026-01", contributions: 3 }],
  });
  expect(output.activity.starsGiven).toBe(14);
  expect(output.repositories.map((repo) => repo.owner)).toEqual(["alice", "bob"]);
});

it("includes every account in a three-profile aggregate", async () => {
  config.github.usernames = ["alice", "bob", "carol"];
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice"))
    .mockResolvedValueOnce(createOutput("bob", {}, createCollection([{ date: "2026-01-07", contributionCount: 2 }])))
    .mockResolvedValueOnce(createOutput("carol", {}, createCollection([{ date: "2026-01-07", contributionCount: 3 }])));

  const { output, extras } = await collectProfiles(plan, config);

  expect(output.profileContributions.totalContributions).toBe(6);
  expect(githubStatsOutputSchema.safeParse(output).success).toBe(true);
  expect(output.repositories).toHaveLength(3);
  expect(output.activity.totalPullRequests).toBe(6);
  expect(extras.profiles?.map((profile) => profile.login)).toEqual(["alice", "bob", "carol"]);
  expect(JSON.parse(readFileSync(config.statsAction.outputPath, "utf8"))).toEqual(output);
});

it("deduplicates repository metadata while adding account-specific contribution counts", async () => {
  config.github.usernames = ["alice", "bob"];
  const oldRepo = createRepository({ metadataFetchedAt: NOW - 1000 });
  const newRepo = createRepository({
    stars: 20,
    forks: 3,
    sources: ["contributed"],
    primaryLanguage: "Rust",
    languages: [{ languageName: "Rust", color: "#dea584", value: 2000, percentage: 100 }],
    codeByteTotal: 2000,
    contributionCounts: { commits: 2, issues: 1, pullRequests: 0, pullRequestReviews: 0, repositoryCreations: 0 },
  });
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", { repositories: [oldRepo] }))
    .mockResolvedValueOnce(createOutput("bob", { repositories: [newRepo] }));

  const { output } = await collectProfiles(plan, config);

  expect(output.repositories).toHaveLength(1);
  expect(output.repositories[0]).toMatchObject({ stars: 20, forks: 3, viewerPermission: null });
  expect(output.repositories[0].sources).toEqual(["owned", "profile-contribution", "contributed"]);
  expect(output.profileContributions.repositoryContributions[0].counts).toEqual({
    commits: 3, issues: 1, pullRequests: 0, pullRequestReviews: 0, repositoryCreations: 0,
  });
  expect(output.repoMetrics).toMatchObject({ starCount: 20, forkCount: 3, codeByteTotal: 2000 });
  expect(output.repoMetrics.topLanguages).toEqual([{ languageName: "Rust", color: "#dea584", value: 2000, percentage: 100 }]);
  expect(output.repoMetrics.repoStats.totalRepos).toBe(1);
  expect(output.activity.repositoriesContributedTo).toBe(1);
  expect(output.profile.followers).toBe(4);
});

it("counts shared-repository traffic once and contributor metrics once per account", async () => {
  config.github.usernames = ["alice", "bob"];
  const repository = createRepository();
  const firstCache = createEmptyStableCache(NOW);
  firstCache.contributorStats[repository.id] = {
    additions: 10, deletions: 2, commits: 3, fetchedAt: NOW - 1000,
    defaultBranchOid: repository.defaultBranchOid, status: "cached",
  };
  firstCache.traffic[repository.id] = {
    count: 100, uniques: 10, days: [], fetchedAt: NOW - 1000, status: "cached",
  };
  const secondCache = createEmptyStableCache(NOW);
  secondCache.contributorStats[repository.id] = {
    additions: 20, deletions: 4, commits: 6, fetchedAt: NOW,
    defaultBranchOid: repository.defaultBranchOid, status: "fresh",
  };
  secondCache.traffic[repository.id] = {
    count: 120, uniques: 12, days: [], fetchedAt: NOW, status: "fresh",
  };
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", { repositories: [repository], cache: firstCache }))
    .mockResolvedValueOnce(createOutput("bob", { repositories: [repository], cache: secondCache }));
  vi.mocked(readStableCache).mockReturnValueOnce(firstCache).mockReturnValueOnce(secondCache);

  const { output } = await collectProfiles(plan, config);

  expect(output.repoMetrics.traffic).toEqual({
    repoViews: 120, repoViewUniques: 12, reposCompleted: 1, reposPending: 0, reposFailed: 0,
  });
  expect(output.repoMetrics.contributorStats).toEqual({
    totalCommits: 9, linesAdded: 30, linesDeleted: 6, linesOfCodeChanged: 36,
    reposCompleted: 1, reposPending: 0, reposFailed: 0,
  });
  expect(output).not.toHaveProperty("legacy");
  expect(output.collectionStatus.complete).toBe(true);
});

it("rebuilds stale canonical derived fields without mutating source outputs", async () => {
  config.github.usernames = ["alice", "bob"];
  const base = createOutput();
  const stale: GitHubStatsOutput = {
    ...base,
    profileContributions: {
      ...base.profileContributions,
      totalContributions: 999,
      stats: { ...base.profileContributions.stats, currentStreak: 999, longestStreak: 999 },
    },
    repoMetrics: {
      ...base.repoMetrics, starCount: 999, codeByteTotal: 999, topLanguages: [],
      repoStats: { ...base.repoMetrics.repoStats, totalRepos: 999 },
      computedStats: { ...base.repoMetrics.computedStats, languageCount: 999 },
    },
    presentation: { ...base.presentation, timeline: [{ period: "1900", contributions: 999 }] },
  };
  const before = structuredClone(stale);
  vi.mocked(runStatsCollection).mockResolvedValueOnce(stale).mockResolvedValueOnce(createOutput("bob"));

  const { output } = await collectProfiles(plan, config);

  expect(output.profileContributions.totalContributions).toBe(2);
  expect(output.profileContributions.contributionCalendar.totalContributions).toBe(2);
  expect(output.profileContributions.stats.currentStreak).toBe(1);
  expect(output.repoMetrics.repoStats.totalRepos).toBe(2);
  expect(output.repoMetrics.computedStats.languageCount).toBe(1);
  expect(output.repoMetrics.codeByteTotal).toBe(2000);
  expect(output.repoMetrics.topLanguages[0].percentage).toBe(100);
  expect(output).not.toHaveProperty("legacy");
  expect(output).not.toHaveProperty("totalContributions");
  expect(output.presentation.readmeSummary).toMatchObject({ totalContributions: 2, starsReceived: 20, currentStreak: 1 });
  expect(output.presentation.timeline).toEqual([{ period: "2026", contributions: 2 }]);
  expect(output.presentation.cards.find((card) => card.id === "stars")?.value).toBe("20");
  expect(stale).toEqual(before);
});

it("inserts calendar gaps so nonconsecutive activity does not become a streak", async () => {
  config.github.usernames = ["alice", "bob"];
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", {}, createCollection([{ date: "2026-01-05", contributionCount: 1 }])))
    .mockResolvedValueOnce(createOutput("bob"));

  const { output } = await collectProfiles(plan, config);

  expect(output.profileContributions.contributionCalendar.weeks.flatMap((week) => week.contributionDays)).toEqual([
    { date: "2026-01-05", contributionCount: 1 },
    { date: "2026-01-06", contributionCount: 0 },
    { date: "2026-01-07", contributionCount: 1 },
  ]);
  expect(output.profileContributions.stats.longestStreak).toBe(1);
});

it("does not report an old trailing streak as current", async () => {
  config.github.usernames = ["alice", "bob"];
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", {}, createCollection([{ date: "2026-01-03", contributionCount: 1 }])))
    .mockResolvedValueOnce(createOutput("bob", {}, createCollection([{ date: "2026-01-04", contributionCount: 1 }])));

  const { output } = await collectProfiles(plan, config);

  expect(output.profileContributions.stats).toMatchObject({ longestStreak: 2, currentStreak: 0 });
});

it("preserves explicit contribution incompleteness even without listed missing years", async () => {
  config.github.usernames = ["alice", "bob"];
  const incomplete = createOutput("bob");
  incomplete.profileContributions.completeness.complete = false;
  vi.mocked(runStatsCollection).mockResolvedValueOnce(createOutput()).mockResolvedValueOnce(incomplete);

  const { output } = await collectProfiles(plan, config);

  expect(output.profileContributions.completeness.complete).toBe(false);
  expect(output.collectionStatus).toMatchObject({ complete: false, coreComplete: false });
  expect(output.presentation.readmeSummary.complete).toBe(false);
});

it("unions completeness years without hiding a missing year fetched for another account", async () => {
  config.github.usernames = ["alice", "bob"];
  const first = createOutput();
  first.profileContributions.completeness.yearsFetched = ["2026", "2025"];
  const second = createOutput("bob");
  second.profileContributions.completeness.missingYears = ["2025"];
  second.profileContributions.completeness.yearsFromCache = ["2024"];
  vi.mocked(runStatsCollection).mockResolvedValueOnce(first).mockResolvedValueOnce(second);

  const { output } = await collectProfiles(plan, config);

  expect(output.profileContributions.completeness).toEqual({
    complete: false, yearsFetched: ["2025", "2026"], yearsFromCache: ["2024"], missingYears: ["2025"],
  });
  expect(output.presentation.readmeSummary.complete).toBe(false);
});

it("marks a pending partial collection incomplete despite stale success flags", async () => {
  config.github.usernames = ["alice", "bob"];
  const second = createOutput("bob");
  second.collectionStatus.backfill.pending = 2;
  vi.mocked(runStatsCollection).mockResolvedValueOnce(createOutput()).mockResolvedValueOnce(second);

  const { output } = await collectProfiles(plan, config);

  expect(output.collectionStatus.complete).toBe(false);
  expect(output.collectionStatus.backfill.pending).toBe(2);
  expect(output.presentation.readmeSummary.complete).toBe(false);
});

it("marks optional aggregates incomplete when per-repository cache data is unavailable", async () => {
  config.github.usernames = ["alice", "bob"];
  const second = createOutput("bob");
  second.repoMetrics.traffic.repoViews = 100;
  vi.mocked(runStatsCollection).mockResolvedValueOnce(createOutput()).mockResolvedValueOnce(second);

  const { output } = await collectProfiles(plan, config);

  expect(output.collectionStatus.complete).toBe(false);
  expect(output.repoMetrics.traffic.repoViews).toBe(0);
  expect(output.collectionStatus.warnings.join("\n")).toContain("[bob] Per-repository optional metric cache is unavailable");
});

it("preserves known traffic while keeping coverage pending for an account with a missing cache", async () => {
  config.github.usernames = ["alice", "bob"];
  const firstCache = createEmptyStableCache(NOW);
  firstCache.traffic.R_alice = {
    count: 100, uniques: 10, days: [], fetchedAt: NOW, status: "cached",
  };
  const second = createOutput("bob");
  second.repoMetrics.traffic = {
    repoViews: 200, repoViewUniques: 20, reposCompleted: 1, reposPending: 0, reposFailed: 0,
  };
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", { cache: firstCache }))
    .mockResolvedValueOnce(second);
  vi.mocked(readStableCache)
    .mockReturnValueOnce(firstCache)
    .mockReturnValueOnce(createEmptyStableCache(NOW));

  const { output } = await collectProfiles(plan, config);

  expect(output.repoMetrics.traffic).toEqual({
    repoViews: 100, repoViewUniques: 10, reposCompleted: 1, reposPending: 1, reposFailed: 0,
  });
  expect(firstCache.traffic.R_alice.status).toBe("cached");
  expect(output.collectionStatus).toMatchObject({ complete: false, backfill: { pending: 1 } });
  expect(output.presentation.readmeSummary.complete).toBe(false);
  expect(githubStatsOutputSchema.safeParse(output).success).toBe(true);
});

it("preserves known contributor totals while keeping shared-repository coverage pending for a missing account cache", async () => {
  config.github.usernames = ["alice", "bob"];
  const repository = createRepository();
  const firstCache = createEmptyStableCache(NOW);
  firstCache.contributorStats[repository.id] = {
    additions: 10, deletions: 2, commits: 3, fetchedAt: NOW,
    defaultBranchOid: repository.defaultBranchOid, status: "cached",
  };
  const second = createOutput("bob", { repositories: [repository] });
  second.repoMetrics.contributorStats = {
    totalCommits: 6, linesAdded: 20, linesDeleted: 4, linesOfCodeChanged: 24,
    reposCompleted: 1, reposPending: 0, reposFailed: 0,
  };
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", { repositories: [repository], cache: firstCache }))
    .mockResolvedValueOnce(second);
  vi.mocked(readStableCache)
    .mockReturnValueOnce(firstCache)
    .mockReturnValueOnce(createEmptyStableCache(NOW));

  const { output } = await collectProfiles(plan, config);

  expect(output.repositories).toHaveLength(1);
  expect(output.repoMetrics.contributorStats).toEqual({
    totalCommits: 3, linesAdded: 10, linesDeleted: 2, linesOfCodeChanged: 12,
    reposCompleted: 0, reposPending: 1, reposFailed: 0,
  });
  expect(firstCache.contributorStats[repository.id].status).toBe("cached");
  expect(output.collectionStatus).toMatchObject({ complete: false, backfill: { pending: 1 } });
  expect(output.presentation.readmeSummary.complete).toBe(false);
  expect(githubStatsOutputSchema.safeParse(output).success).toBe(true);
});

it("does not claim deduplicated private repository totals from redacted account records", async () => {
  config.github.usernames = ["alice", "bob"];
  const repositories = [createRepository(), createRepository({ id: "PRIVATE", isPrivate: true, stars: 100 })];
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", { repositories }))
    .mockResolvedValueOnce(createOutput("bob", { repositories }));

  const { output } = await collectProfiles(plan, config);

  expect(output.repoMetrics.repoStats).toMatchObject({ totalRepos: 1, publicRepos: 1, privateRepos: 0 });
  expect(output.privacy.redactedPrivateRepositories).toBe(2);
  expect(output.collectionStatus).toMatchObject({ complete: false, coreComplete: false });
  expect(output.collectionStatus.warnings.join("\n")).toContain("privacy redaction counts describe records across accounts");
});

it("keeps extras aligned across accounts and deduplicates shared organizations and gists", async () => {
  config.github.usernames = ["alice", "bob", "carol"];
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice"))
    .mockResolvedValueOnce(createOutput("bob"))
    .mockResolvedValueOnce(createOutput("carol"));
  vi.spyOn(GitHubClient.prototype, "restGet")
    .mockResolvedValueOnce([{ id: 1, login: "shared" }])
    .mockResolvedValueOnce([{ id: "one" }])
    .mockResolvedValueOnce([{ id: 1, login: "shared" }, { id: 2, login: "bob-org" }])
    .mockResolvedValueOnce([{ id: "one" }, { id: "two" }])
    .mockResolvedValueOnce([{ id: 3, login: "carol-org" }])
    .mockResolvedValueOnce([{ id: "three" }]);

  const { extras } = await collectProfiles(analyzeTemplate("{{ organizations }} {{ gists }}"), config);

  expect(extras.organizations?.map((org) => org.login)).toEqual(["shared", "bob-org", "carol-org"]);
  expect(extras.gists?.map((gist) => gist.id)).toEqual(["one", "two", "three"]);
});

it("fails clearly on a second-account failure without publishing a partial snapshot", async () => {
  config.github.usernames = ["alice", "bob"];
  writeFileSync(config.statsAction.outputPath, "previous aggregate");
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput())
    .mockRejectedValueOnce(new Error("permission denied"));

  await expect(collectProfiles(plan, config)).rejects.toThrow("Failed to collect GitHub profile bob: permission denied");

  expect(readFileSync(config.statsAction.outputPath, "utf8")).toBe("previous aggregate");
});

it("fails rather than returning successful stub data when no account can be collected", async () => {
  vi.mocked(runStatsCollection).mockRejectedValueOnce(new Error("offline"));

  await expect(collectProfiles(plan, config)).rejects.toThrow("alice: offline");

  expect(existsSync(config.statsAction.outputPath)).toBe(false);
});

it("rejects duplicate account names case-insensitively before double-counting activity", async () => {
  config.github.usernames = ["alice", "Alice"];

  await expect(collectProfiles(plan, config)).rejects.toThrow("Duplicate GitHub profiles");

  expect(runStatsCollection).not.toHaveBeenCalled();
});

it("fails clearly when collection is requested without profiles", async () => {
  config.github.username = null;

  await expect(collectProfiles(plan, config)).rejects.toThrow("No GitHub profiles configured");
});

it("publishes the aggregate to the environment-overridden output path", async () => {
  const outputPath = join(directory, "override.json");
  vi.stubEnv("STATS_OUTPUT_PATH", outputPath);
  config.github.usernames = ["alice", "bob"];
  vi.mocked(runStatsCollection).mockResolvedValueOnce(createOutput()).mockResolvedValueOnce(createOutput("bob"));

  const { output } = await collectProfiles(plan, config);

  expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(output);
  expect(existsSync(config.statsAction.outputPath)).toBe(false);
});

it("retains a core collection failure even when contribution year coverage is complete", async () => {
  config.github.usernames = ["alice", "bob"];
  const second = createOutput("bob");
  second.collectionStatus.coreComplete = false;
  second.collectionStatus.errors = ["Repository discovery incomplete"];
  vi.mocked(runStatsCollection).mockResolvedValueOnce(createOutput()).mockResolvedValueOnce(second);

  const { output } = await collectProfiles(plan, config);

  expect(output.collectionStatus).toMatchObject({ complete: false, coreComplete: false });
  expect(output.collectionStatus.errors).toEqual(["[bob] Repository discovery incomplete"]);
  expect(output.presentation.readmeSummary.complete).toBe(false);
});

it("does not claim complete contribution coverage when an account calendar is absent", async () => {
  config.github.usernames = ["alice", "bob"];
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput())
    .mockResolvedValueOnce(createOutput("bob", {}, createCollection([])));

  const { output } = await collectProfiles(plan, config);

  expect(output.profileContributions.completeness.complete).toBe(false);
  expect(output.presentation.readmeSummary.complete).toBe(false);
  expect(output.collectionStatus.warnings.join("\n")).toContain("[bob] No contribution calendar days available");
});

it("does not trust a stale success flag over optional metric coverage", async () => {
  config.github.usernames = ["alice", "bob"];
  const second = createOutput("bob");
  second.repoMetrics.contributorStats.reposFailed = 1;
  vi.mocked(runStatsCollection).mockResolvedValueOnce(createOutput()).mockResolvedValueOnce(second);

  const { output } = await collectProfiles(plan, config);

  expect(output.collectionStatus.complete).toBe(false);
  expect(output.presentation.readmeSummary.complete).toBe(false);
});

it("deduplicates pending metrics for shared repositories and marks stale success flags incomplete", async () => {
  config.github.usernames = ["alice", "bob"];
  const repository = createRepository();
  const cache = createEmptyStableCache(NOW);
  cache.backfill.pending = [{
    key: `contributors:${repository.id}:abc123`, type: "contributors", repoId: repository.id,
    nameWithOwner: repository.nameWithOwner, priority: 1, reason: "pending",
  }];
  vi.mocked(readStableCache).mockReturnValue(cache);
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", { repositories: [repository], cache }))
    .mockResolvedValueOnce(createOutput("bob", { repositories: [repository], cache }));

  const { output } = await collectProfiles(plan, config);

  expect(output.repoMetrics.contributorStats.reposPending).toBe(1);
  expect(output.collectionStatus.backfill.pending).toBe(1);
  expect(output.collectionStatus.complete).toBe(false);
});

it("deduplicates failed optional metric coverage by repository rather than branch cache key", async () => {
  config.github.usernames = ["alice", "bob"];
  const repository = createRepository();
  const firstCache = createEmptyStableCache(NOW);
  const secondCache = createEmptyStableCache(NOW);
  firstCache.backfill.failures.old = {
    key: `contributors:${repository.id}:old`, failedAt: NOW - 1000, attempts: 1, message: "failed",
  };
  secondCache.backfill.failures.new = {
    key: `contributors:${repository.id}:new`, failedAt: NOW, attempts: 1, message: "failed",
  };
  vi.mocked(readStableCache).mockReturnValueOnce(firstCache).mockReturnValueOnce(secondCache);
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", { repositories: [repository], cache: firstCache }))
    .mockResolvedValueOnce(createOutput("bob", { repositories: [repository], cache: secondCache }));

  const { output } = await collectProfiles(plan, config);

  expect(output.repoMetrics.contributorStats.reposFailed).toBe(1);
  expect(output.collectionStatus.complete).toBe(false);
});

it("keeps contribution summary identities aligned with the newest repository metadata", async () => {
  config.github.usernames = ["alice", "bob"];
  const newest = createRepository({ nameWithOwner: "alice/renamed" });
  const older = createRepository({ metadataFetchedAt: NOW - 1000 });
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput("alice", { repositories: [newest] }))
    .mockResolvedValueOnce(createOutput("bob", { repositories: [older] }));

  const { output } = await collectProfiles(plan, config);

  expect(output.repositories[0].nameWithOwner).toBe("alice/renamed");
  expect(output.profileContributions.repositoryContributions[0].nameWithOwner).toBe("alice/renamed");
});

it("does not treat unfinished cached metric results as complete when queue metadata is missing", async () => {
  config.github.usernames = ["alice", "bob"];
  const cache = createEmptyStableCache(NOW);
  cache.contributorStats.R_bob = {
    additions: 0, deletions: 0, commits: 0, fetchedAt: NOW, defaultBranchOid: "abc123", status: "pending",
  };
  vi.mocked(readStableCache).mockReturnValueOnce(createEmptyStableCache(NOW)).mockReturnValueOnce(cache);
  vi.mocked(runStatsCollection)
    .mockResolvedValueOnce(createOutput())
    .mockResolvedValueOnce(createOutput("bob", { cache }));

  const { output } = await collectProfiles(plan, config);

  expect(output.collectionStatus.complete).toBe(false);
  expect(output.collectionStatus.warnings.join("\n")).toContain("[bob] Optional repository metric cache contains incomplete results");
});
