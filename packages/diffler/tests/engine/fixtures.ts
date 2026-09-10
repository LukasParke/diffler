import type {
  CollectionStatus,
  ContributionsCollection,
  GitHubStatsOutput,
  RepositoryRecord,
} from "@lukasparke/diffler-schemas";
import { DifflerConfigSchema, type DifflerConfig } from "../../src/config.js";
import { emptyContributionsCollection } from "../../src/stats/aggregate.js";
import { createEmptyStableCache } from "../../src/stats/cache.js";
import { buildOutput } from "../../src/stats/output.js";

export const NOW = Date.parse("2026-01-07T12:00:00.000Z");

export function createConfig(): DifflerConfig {
  return DifflerConfigSchema.parse({
    github: { username: "alice", token: "test-token" },
  });
}

export function createRepository(overrides: Partial<RepositoryRecord> = {}): RepositoryRecord {
  return {
    id: "R_alice",
    name: "project",
    nameWithOwner: "alice/project",
    owner: "alice",
    ownerType: "User",
    description: "A project",
    url: "https://github.com/alice/project",
    isArchived: false,
    isFork: false,
    isPrivate: false,
    visibility: "PUBLIC",
    viewerPermission: "ADMIN",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    pushedAt: "2026-01-01T00:00:00Z",
    defaultBranchOid: "abc123",
    stars: 10,
    forks: 2,
    primaryLanguage: "TypeScript",
    topics: ["automation"],
    languages: [{ languageName: "TypeScript", color: "#3178c6", value: 1000, percentage: 100 }],
    codeByteTotal: 1000,
    sources: ["owned", "profile-contribution"],
    contributionCounts: { commits: 1, issues: 0, pullRequests: 0, pullRequestReviews: 0, repositoryCreations: 0 },
    metadataFetchedAt: NOW,
    ...overrides,
  };
}

export function createCollection(
  days: Array<{ date: string; contributionCount: number }> = [
    { date: "2026-01-07", contributionCount: 1 },
  ]
): ContributionsCollection {
  const total = days.reduce((sum, day) => sum + day.contributionCount, 0);
  return {
    ...emptyContributionsCollection(),
    totalCommitContributions: total,
    contributionCalendar: { totalContributions: total, weeks: [{ contributionDays: days }] },
  };
}

export function createStatus(): CollectionStatus {
  return {
    startedAt: NOW - 1000,
    finishedAt: NOW,
    durationMs: 1000,
    complete: true,
    coreComplete: true,
    cache: {
      stablePath: "cache.json",
      volatilePath: "volatile.json",
      contributionYearsFromCache: 0,
      contributionYearsFetched: 1,
      repositoriesFromCache: 0,
      repositoriesFetched: 1,
    },
    backfill: { enabled: true, completedThisRun: 0, pending: 0, failedThisRun: 0, skippedThisRun: 0 },
    rateLimit: { graphql: null, rest: null },
    warnings: [],
    errors: [],
  };
}

export function createOutput(
  username = "alice",
  overrides: Partial<Parameters<typeof buildOutput>[0]> = {},
  collection: ContributionsCollection = createCollection()
): GitHubStatsOutput {
  const repositories = overrides.repositories ?? [createRepository({
    id: `R_${username}`,
    owner: username,
    nameWithOwner: `${username}/project`,
  })];
  return buildOutput({
    profile: {
      name: username,
      login: username,
      bio: null,
      company: null,
      location: null,
      email: null,
      twitterUsername: null,
      websiteUrl: null,
      avatarUrl: `https://example.com/${username}.png`,
      createdAt: "2025-01-01T00:00:00Z",
      followers: 4,
      following: 5,
    },
    activity: {
      totalPullRequests: 2,
      openIssues: 3,
      closedIssues: 4,
      repositoriesContributedTo: 1,
      discussionsStarted: 5,
      discussionsAnswered: 6,
      starsGiven: 7,
    },
    contributions: {
      collection,
      repositoryContributions: repositories.map((repository) => ({
        repositoryId: repository.id,
        nameWithOwner: repository.nameWithOwner,
        owner: repository.owner,
        counts: repository.contributionCounts,
      })),
      repositories,
      yearsFetched: ["2026"],
      yearsFromCache: [],
      missingYears: [],
    },
    repositories,
    cache: createEmptyStableCache(NOW),
    config: createConfig().statsAction,
    collectionStatus: createStatus(),
    fetchedAt: NOW,
    ...overrides,
  });
}
