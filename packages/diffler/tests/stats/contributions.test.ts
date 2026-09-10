import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../../src/github/client.js";
import { createEmptyStableCache } from "../../src/stats/cache.js";
import { collectContributionYears } from "../../src/stats/github.js";
import { RequestScheduler } from "../../src/stats/scheduler.js";
import {
  NOW,
  cachedYear,
  contributionCollection,
  enrichment,
  githubConfig,
  graphqlResponse,
  queueContributionResponses,
  rawRepository,
  repository,
  statsConfig,
} from "./fixtures.js";

describe("contribution enrichment recovery", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
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

  it("retries a historical year whose calendar succeeded but repository enrichment failed", async () => {
    const cache = createEmptyStableCache();
    const client = new GitHubClient(githubConfig);
    fetchMock
      .mockResolvedValueOnce(graphqlResponse({ viewer: {
        contributionsCollection: contributionCollection("2024", 7),
      } }))
      .mockResolvedValueOnce(Response.json({ errors: [{ message: "Enrichment unavailable" }] }));
    queueContributionResponses(fetchMock, contributionCollection("2025"));
    queueContributionResponses(fetchMock);

    const first = await collectContributionYears(
      client, new RequestScheduler(statsConfig), cache, "2024-01-01T00:00:00.000Z", false, 1
    );

    expect(first.collection.totalCommitContributions).toBe(7);
    expect(cache.contributionYears["2024"].immutable).toBe(false);

    queueContributionResponses(fetchMock, contributionCollection("2024", 7), enrichment([
      { repository: rawRepository(), contributions: { totalCount: 7 } },
    ]));
    queueContributionResponses(fetchMock, contributionCollection("2025"));
    queueContributionResponses(fetchMock);

    const second = await collectContributionYears(
      client, new RequestScheduler(statsConfig), cache, "2024-01-01T00:00:00.000Z", false, 1
    );

    expect(second.yearsFetched).toEqual(["2024", "2025", "2026"]);
    expect(second.repositoryContributions[0].counts.commits).toBe(7);
    expect(cache.contributionYears["2024"].immutable).toBe(true);
  });

  it("retains known repository enrichment when its refresh fails", async () => {
    const cache = createEmptyStableCache();
    const repo = repository();
    const summary = {
      repositoryId: repo.id, nameWithOwner: repo.nameWithOwner, owner: repo.owner,
      counts: { ...repo.contributionCounts, commits: 7 },
    };
    cache.contributionYears["2024"] = cachedYear({
      immutable: false, repositories: [repo], repositoryContributions: [summary],
    });
    fetchMock
      .mockResolvedValueOnce(graphqlResponse({ viewer: {
        contributionsCollection: contributionCollection("2024", 7),
      } }))
      .mockResolvedValueOnce(Response.json({ errors: [{ message: "Enrichment unavailable" }] }));
    queueContributionResponses(fetchMock, contributionCollection("2025"));
    queueContributionResponses(fetchMock);

    const result = await collectContributionYears(
      new GitHubClient(githubConfig), new RequestScheduler(statsConfig), cache,
      "2024-01-01T00:00:00.000Z", false, 1
    );

    expect(result.repositoryContributions).toEqual([summary]);
    expect(result.repositories[0].contributionCounts.commits).toBe(7);
    expect(cache.contributionYears["2024"].immutable).toBe(false);
  });
});
