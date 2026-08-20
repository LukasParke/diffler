// Re-export the shared v2 schema types for backward compatibility
export {
  OUTPUT_SCHEMA_VERSION,
  CACHE_SCHEMA_VERSION,
  type Language,
  type ContributionData,
  type ContributionWeek,
  type ContributionsCollection,
  type MonthlyContribution,
  type YearlyContribution,
  type ContributionStats,
  type RateLimitInfo,
  type CollectionSource,
  type RepositoryContributionCounts,
  type RepositoryRecord,
  type RepoStats,
  type TopicCount,
  type ComputedStats,
  type UserProfile,
  type ActivityStats,
  type RepositoryContributionSummary,
  type ProfileContributions,
  type RepoMetrics,
  type PackageDownloadCounts,
  type PackageMetric,
  type PackageMetrics,
  type PresentationData,
  type PrivacyReport,
  type CollectionStatus,
  type GitHubStatsOutput,
} from "@lukasparke/diffler-schemas";

// ---------------------------------------------------------------------------
// Internal collection-engine types (not part of the public output schema)
// ---------------------------------------------------------------------------

export type StatsActionConfig = {
  outputPath: string;
  cachePath: string;
  volatileCachePath: string;
  maxRuntimeSeconds: number;
  graphqlConcurrency: number;
  restConcurrency: number;
  minGraphqlRemaining: number;
  minRestRemaining: number;
  includeTraffic: boolean;
  includeRestRepoStats: boolean;
  includePrivateRepositoryMetrics: boolean;
  includePrivateRepositoryDetails: boolean;
  includePrivateCacheDetails: boolean;
  backfillMode: "resume" | "refresh" | "off";
  packageSources: PackageSourceConfig[];
};

export type PackageSourceConfig = {
  provider: string;
  packages: string[];
};

export type ContributorStatsSummary = {
  additions: number;
  deletions: number;
  commits: number;
  fetchedAt: number;
  defaultBranchOid: string | null;
  status: "fresh" | "cached" | "pending" | "failed" | "skipped";
  error?: string;
};

export type TrafficDay = {
  timestamp: string;
  count: number;
  uniques: number;
};

export type TrafficSummary = {
  count: number;
  uniques: number;
  days: TrafficDay[];
  fetchedAt: number;
  status: "fresh" | "cached" | "pending" | "failed" | "skipped";
  error?: string;
};

export type BackfillItemType = "contributors" | "traffic";

export type BackfillItem = {
  key: string;
  type: BackfillItemType;
  repoId: string;
  nameWithOwner: string;
  priority: number;
  reason: string;
};

export type BackfillFailure = {
  key: string;
  failedAt: number;
  attempts: number;
  message: string;
};

import type {
  CACHE_SCHEMA_VERSION,
  CollectionSource,
  ContributionsCollection,
  RateLimitInfo,
  RepositoryContributionSummary,
  RepositoryRecord,
} from "@lukasparke/diffler-schemas";

export type CachedContributionYear = {
  year: string;
  from: string;
  to: string;
  fetchedAt: number;
  immutable: boolean;
  data: ContributionsCollection;
  repositoryContributions: RepositoryContributionSummary[];
  repositories: RepositoryRecord[];
};

export type CachedRepository = {
  fetchedAt: number;
  repository: RepositoryRecord;
};

export type CachedContributorStats = ContributorStatsSummary;

export type CachedTraffic = TrafficSummary;

export type StableCache = {
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  updatedAt: number;
  contributionYears: Record<string, CachedContributionYear>;
  repositories: Record<string, CachedRepository>;
  contributorStats: Record<string, CachedContributorStats>;
  traffic: Record<string, CachedTraffic>;
  backfill: {
    pending: BackfillItem[];
    completed: Record<string, number>;
    failures: Record<string, BackfillFailure>;
  };
};

export type CachedEtag = {
  etag?: string;
  lastModified?: string;
  updatedAt: number;
};

export type VolatileCache = {
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  updatedAt: number;
  restEtags: Record<string, CachedEtag>;
};

// ---------------------------------------------------------------------------
// GraphQL internal types
// ---------------------------------------------------------------------------

export type RawGraphQLLanguageEdge = {
  size: number;
  node: {
    color: string | null;
    name: string;
  };
};

export type RawGraphQLRepository = {
  id: string;
  name: string;
  nameWithOwner: string;
  owner: {
    login: string;
    __typename?: string;
  };
  description: string | null;
  url?: string | null;
  isArchived: boolean;
  isFork: boolean;
  isPrivate: boolean;
  visibility?: string | null;
  viewerPermission?: string | null;
  createdAt: string;
  updatedAt: string;
  pushedAt?: string | null;
  defaultBranchRef?: {
    target?: {
      oid?: string | null;
    } | null;
  } | null;
  stargazers?: {
    totalCount: number;
  };
  forkCount: number;
  primaryLanguage: {
    name: string;
    color?: string | null;
  } | null;
  repositoryTopics: {
    nodes: Array<{
      topic: {
        name: string;
      };
    }>;
  };
  languages: {
    edges: RawGraphQLLanguageEdge[];
  };
};

export type GraphQLContributionRepositoryGroup = {
  repository: RawGraphQLRepository;
  contributions: {
    totalCount: number;
  };
};

export type ContributionsCollectionWithRepositories = ContributionsCollection & {
  commitContributionsByRepository: GraphQLContributionRepositoryGroup[];
  issueContributionsByRepository: GraphQLContributionRepositoryGroup[];
  pullRequestContributionsByRepository: GraphQLContributionRepositoryGroup[];
  pullRequestReviewContributionsByRepository: GraphQLContributionRepositoryGroup[];
  repositoryContributions: {
    nodes: Array<{ repository: RawGraphQLRepository }>;
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
    totalCount: number;
  };
};

export type ContributionRepositoryEnrichment = Pick<
  ContributionsCollectionWithRepositories,
  | "commitContributionsByRepository"
  | "issueContributionsByRepository"
  | "pullRequestContributionsByRepository"
  | "pullRequestReviewContributionsByRepository"
  | "repositoryContributions"
>;

export type RepositoryDiscovery = Pick<
  RawGraphQLRepository,
  "id" | "name" | "nameWithOwner" | "owner" | "updatedAt" | "pushedAt" | "defaultBranchRef"
>;

export type RepositoryDiscoveryConnection = {
  nodes: RepositoryDiscovery[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export type RepositoryDiscoveryWithSource = {
  repository: RepositoryDiscovery;
  source: CollectionSource;
};

export type GraphQLViewerProfile = {
  name: string | null;
  login: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  twitterUsername: string | null;
  websiteUrl: string | null;
  avatarUrl: string;
  createdAt: string;
  followers: { totalCount: number };
  following: { totalCount: number };
  starredRepositories: { totalCount: number };
  pullRequests: { totalCount: number };
  repositoriesContributedTo: { totalCount: number };
  openIssues: { totalCount: number };
  closedIssues: { totalCount: number };
  repositoryDiscussions: { totalCount: number };
  repositoryDiscussionComments: { totalCount: number };
};

export type GraphQLResponse<T> = T & {
  rateLimit?: RateLimitInfo;
};
