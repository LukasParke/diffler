import type { Mock } from "vitest";
import type { GitHubConfig } from "../../src/config.js";
import { emptyContributionsCollection } from "../../src/stats/aggregate.js";
import type {
  CachedContributionYear,
  ContributionRepositoryEnrichment,
  ContributionsCollection,
  ContributorStatsSummary,
  GraphQLContributionRepositoryGroup,
  GraphQLViewerProfile,
  RawGraphQLRepository,
  RepositoryDiscoveryConnection,
  RepositoryRecord,
  StatsActionConfig,
  TrafficSummary,
} from "../../src/stats/types.js";

export const NOW = new Date("2026-06-01T12:00:00.000Z");

export const githubConfig: GitHubConfig = {
  username: "alice",
  usernames: [],
  token: "test-token-for-bob",
  profiles: [],
  apiUrl: "https://api.github.com",
  graphqlUrl: "https://api.github.com/graphql",
  includeOrgs: false,
  largeRepoMode: false,
};

export const statsConfig: StatsActionConfig = {
  outputPath: "/stats/output.json",
  cachePath: "/stats/cache.json",
  volatileCachePath: "/stats/volatile.json",
  maxRuntimeSeconds: 480,
  graphqlConcurrency: 1,
  restConcurrency: 1,
  minGraphqlRemaining: 500,
  minRestRemaining: 750,
  includeTraffic: true,
  includeRestRepoStats: true,
  includePrivateRepositoryMetrics: false,
  includePrivateRepositoryDetails: false,
  includePrivateCacheDetails: false,
  backfillMode: "resume",
  packageSources: [],
};

export function profile(
  overrides: Partial<GraphQLViewerProfile> = {}
): GraphQLViewerProfile {
  return {
    name: "Alice",
    login: "alice",
    bio: null,
    company: null,
    location: null,
    email: null,
    twitterUsername: null,
    websiteUrl: null,
    avatarUrl: "https://example.com/alice.png",
    createdAt: "2026-01-01T00:00:00.000Z",
    followers: { totalCount: 11 },
    following: { totalCount: 2 },
    starredRepositories: { totalCount: 3 },
    pullRequests: { totalCount: 4 },
    repositoriesContributedTo: { totalCount: 5 },
    openIssues: { totalCount: 6 },
    closedIssues: { totalCount: 7 },
    repositoryDiscussions: { totalCount: 8 },
    repositoryDiscussionComments: { totalCount: 9 },
    ...overrides,
  };
}

export function rawRepository(
  overrides: Partial<RawGraphQLRepository> = {}
): RawGraphQLRepository {
  return {
    id: "R_SHARED",
    name: "shared",
    nameWithOwner: "alice/shared",
    owner: { login: "alice", __typename: "User" },
    description: "A public project",
    url: "https://github.com/alice/shared",
    isArchived: false,
    isFork: false,
    isPrivate: false,
    visibility: "PUBLIC",
    viewerPermission: "ADMIN",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    pushedAt: "2026-05-01T00:00:00.000Z",
    defaultBranchRef: { target: { oid: "current-sha" } },
    stargazers: { totalCount: 10 },
    forkCount: 2,
    primaryLanguage: { name: "TypeScript", color: "#3178c6" },
    repositoryTopics: { nodes: [{ topic: { name: "testing" } }] },
    languages: {
      edges: [{ size: 1000, node: { name: "TypeScript", color: "#3178c6" } }],
    },
    ...overrides,
  };
}

export function repository(
  overrides: Partial<RepositoryRecord> = {}
): RepositoryRecord {
  return {
    id: "R_SHARED",
    name: "shared",
    nameWithOwner: "alice/shared",
    owner: "alice",
    ownerType: "User",
    description: "A public project",
    url: "https://github.com/alice/shared",
    isArchived: false,
    isFork: false,
    isPrivate: false,
    visibility: "PUBLIC",
    viewerPermission: "ADMIN",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    pushedAt: "2026-05-01T00:00:00.000Z",
    defaultBranchOid: "current-sha",
    stars: 10,
    forks: 2,
    primaryLanguage: "TypeScript",
    topics: ["testing"],
    languages: [
      { languageName: "TypeScript", color: "#3178c6", value: 1000, percentage: 100 },
    ],
    codeByteTotal: 1000,
    sources: ["owned"],
    contributionCounts: {
      commits: 0,
      issues: 0,
      pullRequests: 0,
      pullRequestReviews: 0,
      repositoryCreations: 0,
    },
    metadataFetchedAt: NOW.getTime() - 86400000,
    ...overrides,
  };
}

export function contributionCollection(year = "2026", commits = 0): ContributionsCollection {
  return {
    ...emptyContributionsCollection(),
    totalCommitContributions: commits,
    contributionCalendar: {
      totalContributions: commits,
      weeks: [{ contributionDays: [{ date: `${year}-01-02`, contributionCount: commits }] }],
    },
  };
}

export function enrichment(
  groups: GraphQLContributionRepositoryGroup[] = []
): ContributionRepositoryEnrichment {
  return {
    commitContributionsByRepository: groups,
    issueContributionsByRepository: [],
    pullRequestContributionsByRepository: [],
    pullRequestReviewContributionsByRepository: [],
    repositoryContributions: {
      nodes: [],
      totalCount: 0,
      pageInfo: { endCursor: null, hasNextPage: false },
    },
  };
}

export function cachedYear(
  overrides: Partial<CachedContributionYear> = {}
): CachedContributionYear {
  return {
    year: "2024",
    from: "2024-01-01T00:00:00.000Z",
    to: "2025-01-01T00:00:00.000Z",
    fetchedAt: NOW.getTime() - 86400000,
    immutable: true,
    data: contributionCollection("2024", 100),
    repositoryContributions: [],
    repositories: [],
    ...overrides,
  };
}

export function contributorStats(
  overrides: Partial<ContributorStatsSummary> = {}
): ContributorStatsSummary {
  return {
    additions: 70,
    deletions: 20,
    commits: 3,
    fetchedAt: NOW.getTime() - 86400000,
    defaultBranchOid: "current-sha",
    status: "fresh",
    ...overrides,
  };
}

export function traffic(overrides: Partial<TrafficSummary> = {}): TrafficSummary {
  return {
    count: 12,
    uniques: 4,
    days: [{ timestamp: "2026-05-31T00:00:00Z", count: 12, uniques: 4 }],
    fetchedAt: NOW.getTime() - 86400000,
    status: "fresh",
    ...overrides,
  };
}

export function graphqlResponse(data: Record<string, unknown>): Response {
  return Response.json({
    data: {
      ...data,
      rateLimit: {
        limit: 5000,
        remaining: 4000,
        used: 1000,
        resetAt: "2026-06-01T13:00:00.000Z",
      },
    },
  });
}

export function queueProfileResponse(
  fetchMock: Mock<typeof fetch>,
  value = profile()
): void {
  fetchMock.mockResolvedValueOnce(graphqlResponse({ viewer: value }));
}

export function queueContributionResponses(
  fetchMock: Mock<typeof fetch>,
  collection = contributionCollection(),
  repositories = enrichment()
): void {
  fetchMock
    .mockResolvedValueOnce(graphqlResponse({ viewer: { contributionsCollection: collection } }))
    .mockResolvedValueOnce(graphqlResponse({ viewer: { contributionsCollection: repositories } }));
}

export function discoveryConnection(
  repositories: RawGraphQLRepository[] = []
): RepositoryDiscoveryConnection {
  return {
    nodes: repositories,
    pageInfo: { endCursor: null, hasNextPage: false },
  };
}

export function queueDiscoveryResponses(
  fetchMock: Mock<typeof fetch>,
  affiliated: RawGraphQLRepository[] = [],
  contributed: RawGraphQLRepository[] = []
): void {
  fetchMock
    .mockResolvedValueOnce(graphqlResponse({
      viewer: { repositories: discoveryConnection(affiliated) },
    }))
    .mockResolvedValueOnce(graphqlResponse({
      viewer: { repositoriesContributedTo: discoveryConnection(contributed) },
    }));
}
