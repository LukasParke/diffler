import { z } from "zod";
import type { GitHubClient } from "../github/client.js";
import type {
  ActivityStats,
  BackfillItem,
  CachedContributionYear,
  CachedTraffic,
  ContributionRepositoryEnrichment,
  ContributionsCollection,
  ContributorStatsSummary,
  GraphQLContributionRepositoryGroup,
  GraphQLResponse,
  GraphQLViewerProfile,
  RateLimitInfo,
  RawGraphQLRepository,
  RepositoryContributionCounts,
  RepositoryContributionSummary,
  RepositoryDiscovery,
  RepositoryDiscoveryConnection,
  RepositoryRecord,
  StableCache,
  StatsActionConfig,
  TrafficDay,
  UserProfile,
  VolatileCache,
} from "./types.js";
import {
  cacheContributionYear,
  cacheRepository,
  metadataOnlyRepository,
  mergeBackfillQueue,
  recordBackfillFailure,
  repositoryMetricCacheKey,
  repositoryMetricVersion,
  shouldReuseContributionYear,
} from "./cache.js";
import { aggregateLanguages, mergeContributionsCollections } from "./aggregate.js";
import { isBudgetStopped, RequestScheduler, runLimited } from "./scheduler.js";

const REPO_FIELDS = `
  id
  name
  nameWithOwner
  owner {
    login
    __typename
  }
  description
  url
  isArchived
  isFork
  isPrivate
  visibility
  viewerPermission
  createdAt
  updatedAt
  pushedAt
  defaultBranchRef {
    target {
      oid
    }
  }
  stargazers {
    totalCount
  }
  forkCount
  primaryLanguage {
    name
    color
  }
  repositoryTopics(first: 20) {
    nodes {
      topic {
        name
      }
    }
  }
  languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
    edges {
      size
      node {
        color
        name
      }
    }
  }
`;

const REPO_DISCOVERY_FIELDS = `
  id
  name
  nameWithOwner
  owner {
    login
    __typename
  }
  isPrivate
  visibility
  viewerPermission
  updatedAt
  pushedAt
  defaultBranchRef {
    target {
      oid
    }
  }
`;

const RATE_LIMIT_FIELDS = `
  rateLimit {
    limit
    remaining
    used
    resetAt
  }
`;

const contributorResponseSchema = z.array(z.object({
  author: z.object({ login: z.string() }).nullable(),
  weeks: z.array(z.object({
    a: z.number().finite().nonnegative(),
    d: z.number().finite().nonnegative(),
    c: z.number().finite().nonnegative(),
  })),
}));

const trafficResponseSchema = z.object({
  count: z.number().finite().nonnegative(),
  uniques: z.number().finite().nonnegative(),
  views: z.array(z.object({
    timestamp: z.string(),
    count: z.number().finite().nonnegative(),
    uniques: z.number().finite().nonnegative(),
  })),
});

export type ProfileCollection = {
  profile: UserProfile;
  activity: ActivityStats;
};

export type ContributionCollectionResult = {
  collection: ContributionsCollection;
  repositoryContributions: RepositoryContributionSummary[];
  repositories: RepositoryRecord[];
  yearsFetched: string[];
  yearsFromCache: string[];
  missingYears: string[];
  incompleteEnrichmentYears?: string[];
};

export type RepositoryUniverseResult = {
  repositories: RepositoryRecord[];
  repositoriesFetched: number;
  repositoriesFromCache: number;
};

export type BackfillResult = {
  completed: number;
  failed: number;
  skipped: number;
  pending: BackfillItem[];
};

type RepositoryDiscoveryWithSource = {
  repository: RepositoryDiscovery;
  source: RepositoryRecord["sources"][number];
};

export async function collectProfile(
  client: GitHubClient,
  scheduler: RequestScheduler
): Promise<ProfileCollection> {
  const target = userQueryTarget(client);
  const response = await scheduler.graphql(
    "account profile",
    () =>
      client.graphqlQuery(
        `query viewerProfile${target.declaration} {
          ${target.field} {
            name
            login
            bio
            company
            location
            email
            twitterUsername
            websiteUrl
            avatarUrl
            createdAt
            followers {
              totalCount
            }
            following {
              totalCount
            }
            starredRepositories {
              totalCount
            }
            pullRequests(first: 1) {
              totalCount
            }
            repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY, PULL_REQUEST_REVIEW]) {
              totalCount
            }
            openIssues: issues(states: OPEN) {
              totalCount
            }
            closedIssues: issues(states: CLOSED) {
              totalCount
            }
            repositoryDiscussions {
              totalCount
            }
            repositoryDiscussionComments(onlyAnswers: true) {
              totalCount
            }
          }
          ${RATE_LIMIT_FIELDS}
        }`,
        target.variables
      ) as Promise<GraphQLResponse<{ viewer: GraphQLViewerProfile | null }>>,
    false
  );

  const viewer = response.viewer;
  if (!viewer) {
    throw new Error("Configured GitHub account was not found");
  }
  if (
    client.targetUsername &&
    viewer.login.toLowerCase() !== client.targetUsername.toLowerCase()
  ) {
    throw new Error("GitHub profile does not match the configured account");
  }
  return {
    profile: {
      name: viewer.name || "",
      login: viewer.login,
      bio: viewer.bio,
      company: viewer.company,
      location: viewer.location,
      email: viewer.email,
      twitterUsername: viewer.twitterUsername,
      websiteUrl: viewer.websiteUrl,
      avatarUrl: viewer.avatarUrl,
      createdAt: viewer.createdAt,
      followers: viewer.followers.totalCount,
      following: viewer.following.totalCount,
    },
    activity: {
      totalPullRequests: viewer.pullRequests.totalCount,
      openIssues: viewer.openIssues.totalCount,
      closedIssues: viewer.closedIssues.totalCount,
      repositoriesContributedTo: viewer.repositoriesContributedTo.totalCount,
      discussionsStarted: viewer.repositoryDiscussions.totalCount,
      discussionsAnswered: viewer.repositoryDiscussionComments.totalCount,
      starsGiven: viewer.starredRepositories.totalCount,
    },
  };
}

export async function collectRepositoryUniverse(
  client: GitHubClient,
  scheduler: RequestScheduler,
  cache: StableCache,
  includePrivateCacheDetails: boolean,
  username: string,
  contributionRepositories: RepositoryRecord[] = []
): Promise<RepositoryUniverseResult> {
  const fetchedAt = Date.now();
  const target = userQueryTarget(client, ["$cursor: String"]);
  const discoveredRepositories: RepositoryDiscoveryWithSource[] = [];

  const affiliated = await paginateRepositoryDiscoveryConnection(
    "account repositories",
    scheduler,
    (cursor) =>
      client.graphqlQuery(
        `query viewerRepositories${target.declaration} {
          ${target.field} {
            repositories(
              first: 100
              after: $cursor
              ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
              orderBy: {field: UPDATED_AT, direction: DESC}
            ) {
              nodes {
                ${REPO_DISCOVERY_FIELDS}
              }
              pageInfo {
                endCursor
                hasNextPage
              }
            }
          }
          ${RATE_LIMIT_FIELDS}
        }`,
        { ...target.variables, cursor }
      ) as Promise<GraphQLResponse<{ viewer: { repositories: RepositoryDiscoveryConnection } }>>,
    (response) => response.viewer.repositories
  );

  for (const repository of affiliated) {
    const source = repository.owner.login.toLowerCase() === username.toLowerCase()
      ? "owned"
      : "affiliated";
    discoveredRepositories.push({ repository, source });
  }

  const contributed = await paginateRepositoryDiscoveryConnection(
    "repositories contributed to",
    scheduler,
    (cursor) =>
      client.graphqlQuery(
        `query viewerContributedRepositories${target.declaration} {
          ${target.field} {
            repositoriesContributedTo(
              first: 100
              after: $cursor
              includeUserRepositories: false
              contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY, PULL_REQUEST_REVIEW]
              orderBy: {field: UPDATED_AT, direction: DESC}
            ) {
              nodes {
                ${REPO_DISCOVERY_FIELDS}
              }
              pageInfo {
                endCursor
                hasNextPage
              }
            }
          }
          ${RATE_LIMIT_FIELDS}
        }`,
        { ...target.variables, cursor }
      ) as Promise<GraphQLResponse<{ viewer: { repositoriesContributedTo: RepositoryDiscoveryConnection } }>>,
    (response) => response.viewer.repositoriesContributedTo
  );

  for (const repository of contributed) {
    discoveredRepositories.push({ repository, source: "contributed" });
  }

  const materialized = await materializeDiscoveredRepositories(
    client,
    scheduler,
    cache,
    discoveredRepositories,
    fetchedAt,
    [
      ...Object.values(cache.repositories).map((entry) => ({
        ...metadataOnlyRepository(entry.repository),
        sources: addSource(entry.repository.sources, "cache"),
      })),
      ...contributionRepositories.map(metadataOnlyRepository),
    ]
  );

  const liveRepositoryIds = new Set(materialized.repositories.map((repo) => repo.id));
  for (const id of Object.keys(cache.repositories)) {
    if (!liveRepositoryIds.has(id)) delete cache.repositories[id];
  }

  for (const repository of materialized.repositories) {
    cacheRepository(cache, repository, includePrivateCacheDetails);
  }

  return {
    repositories: materialized.repositories,
    repositoriesFetched: materialized.fetched,
    repositoriesFromCache: materialized.reused,
  };
}

export async function collectContributionYears(
  client: GitHubClient,
  scheduler: RequestScheduler,
  cache: StableCache,
  createdAt: string,
  includePrivateCacheDetails = false,
  graphqlConcurrency = 2
): Promise<ContributionCollectionResult> {
  const createdYear = new Date(createdAt).getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from(
    { length: currentYear - createdYear + 1 },
    (_, index) => createdYear + index
  );
  const fetched: CachedContributionYear[] = [];
  const fromCache: CachedContributionYear[] = [];
  const missingYears: string[] = [];

  await runLimited(years, graphqlConcurrency, async (year) => {
    const cached = cache.contributionYears[String(year)];
    if (shouldReuseContributionYear(cached, year, currentYear)) {
      fromCache.push(cached);
      return;
    }

    try {
      const contributionYear = await fetchContributionYear(
        client,
        scheduler,
        createdAt,
        year,
        currentYear,
        cached
      );
      fetched.push(contributionYear);
      cacheContributionYear(cache, contributionYear, includePrivateCacheDetails);
    } catch {
      if (cached) {
        fromCache.push(cached);
      } else {
        missingYears.push(String(year));
      }
      console.warn(
        `Failed to collect contribution year ${year}; ${cached ? "using cached data" : "no cached data available"}`
      );
    }
  });

  const orderedYears = [...fromCache, ...fetched].sort((a, b) =>
    a.year.localeCompare(b.year)
  );
  const collection = mergeContributionsCollections(orderedYears.map((year) => year.data));
  const repositoryContributions = mergeRepositoryContributions(
    orderedYears.flatMap((year) => year.repositoryContributions)
  );
  const contributionsByRepository = new Map(
    repositoryContributions.map((summary) => [summary.repositoryId, summary.counts])
  );
  const repositories = mergeRepositories(
    orderedYears.flatMap((year) => year.repositories || [])
  ).map((repository) => ({
    ...repository,
    contributionCounts: contributionsByRepository.get(repository.id) ?? repository.contributionCounts,
  }));
  for (const repository of repositories) {
    cacheRepository(cache, repository, includePrivateCacheDetails);
  }

  return {
    collection,
    repositoryContributions,
    repositories,
    yearsFetched: fetched.map((year) => year.year).sort(),
    yearsFromCache: fromCache.map((year) => year.year).sort(),
    missingYears: missingYears.sort(),
    incompleteEnrichmentYears: orderedYears
      .filter((year) => year.enrichmentComplete === false)
      .map((year) => year.year),
  };
}

export function buildBackfillQueue(
  repositories: RepositoryRecord[],
  cache: StableCache,
  config: StatsActionConfig
): BackfillItem[] {
  if (config.backfillMode === "off") return [];

  const next: BackfillItem[] = [];
  const forceRefresh = config.backfillMode === "refresh";
  const pendingKeys = new Set(cache.backfill.pending.map((item) => item.key));
  for (const repo of repositories) {
    if (
      repo.isPrivate &&
      !config.includePrivateRepositoryMetrics &&
      !config.includePrivateRepositoryDetails
    ) {
      continue;
    }

    const basePriority = getRepositoryPriority(repo);
    const contributorKey = `contributors:${repo.id}:${repo.defaultBranchOid}`;
    const metricCacheKey = repositoryMetricCacheKey(
      repo,
      config.includePrivateRepositoryDetails
    );
    const metricVersion = repositoryMetricVersion(
      repo,
      config.includePrivateRepositoryDetails
    );
    const contributorStats = cache.contributorStats[metricCacheKey];
    const contributorStatsComplete =
      contributorStats?.defaultBranchOid === metricVersion &&
      ["fresh", "cached"].includes(contributorStats.status);
    if (
      config.includeRestRepoStats &&
      repo.defaultBranchOid &&
      (forceRefresh || !contributorStatsComplete || pendingKeys.has(contributorKey))
    ) {
      next.push({
        key: contributorKey,
        type: "contributors",
        repoId: repo.id,
        nameWithOwner: repo.nameWithOwner,
        priority: basePriority,
        reason: "default branch stats missing or stale",
      });
    }

    const trafficKey = `traffic:${repo.id}`;
    const traffic = cache.traffic[metricCacheKey];
    if (
      config.includeTraffic &&
      canReadTraffic(repo) &&
      (forceRefresh || pendingKeys.has(trafficKey) || !traffic || !["fresh", "cached"].includes(traffic.status) ||
        Date.now() - traffic.fetchedAt > 20 * 60 * 60 * 1000)
    ) {
      next.push({
        key: trafficKey,
        type: "traffic",
        repoId: repo.id,
        nameWithOwner: repo.nameWithOwner,
        priority: basePriority + 5,
        reason: "traffic data missing or older than 20 hours",
      });
    }
  }

  const eligibleKeys = new Set(next.map((item) => item.key));
  const merged = forceRefresh ? next : mergeBackfillQueue(
    cache.backfill.pending.filter((item) => eligibleKeys.has(item.key)),
    next
  );
  return merged.sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
}

export async function processBackfillQueue(
  client: GitHubClient,
  scheduler: RequestScheduler,
  cache: StableCache,
  volatileCache: VolatileCache,
  repositories: RepositoryRecord[],
  queue: BackfillItem[],
  username: string,
  config: StatsActionConfig
): Promise<BackfillResult> {
  if (config.backfillMode === "off") {
    cache.backfill.pending = [];
    return { completed: 0, failed: 0, skipped: 0, pending: [] };
  }

  const byId = new Map(repositories.map((repo) => [repo.id, repo]));
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  const pending = new Set(queue.map((item) => item.key));

  await runLimited(queue, config.restConcurrency, async (item) => {
    const repo = byId.get(item.repoId);
    if (!repo) {
      skipped++;
      pending.delete(item.key);
      return;
    }

    if (!scheduler.shouldStartOptional("rest")) {
      skipped++;
      return;
    }

    try {
      const metricCacheKey = repositoryMetricCacheKey(
        repo,
        config.includePrivateRepositoryDetails
      );
      let status: ContributorStatsSummary["status"];
      if (item.type === "contributors") {
        const previous = cache.contributorStats[metricCacheKey];
        const contributorStats = await fetchContributorStats(
          client,
          scheduler,
          volatileCache,
          previous,
          repo,
          username
        );
        cache.contributorStats[metricCacheKey] = {
          ...contributorStats,
          defaultBranchOid: contributorStats.status === "fresh" || contributorStats.status === "cached"
            ? repositoryMetricVersion(repo, config.includePrivateRepositoryDetails)
            : previous?.defaultBranchOid ?? repositoryMetricVersion(repo, config.includePrivateRepositoryDetails),
        };
        status = contributorStats.status;
      } else {
        cache.traffic[metricCacheKey] = await fetchTraffic(
          client,
          scheduler,
          volatileCache,
          cache.traffic[metricCacheKey],
          repo
        );
        status = cache.traffic[metricCacheKey].status;
      }
      delete cache.backfill.failures[item.key];
      if (status !== "fresh" && status !== "cached") {
        delete cache.backfill.completed[item.key];
        return;
      }
      cache.backfill.completed[item.key] = Date.now();
      pending.delete(item.key);
      completed++;
    } catch (error) {
      if (isBudgetStopped(error)) {
        skipped++;
        return;
      }
      failed++;
      delete cache.backfill.completed[item.key];
      recordBackfillFailure(
        cache.backfill.failures,
        item,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  cache.backfill.pending = queue.filter((item) => pending.has(item.key));
  return {
    completed,
    failed,
    skipped,
    pending: cache.backfill.pending,
  };
}

export function mergeRepositories(repositories: RepositoryRecord[]): RepositoryRecord[] {
  const byId = new Map<string, RepositoryRecord>();

  for (const repository of repositories) {
    const current = byId.get(repository.id);
    if (!current) {
      byId.set(repository.id, {
        ...repository,
        sources: unique(repository.sources),
      });
      continue;
    }

    const newer =
      repository.metadataFetchedAt >= current.metadataFetchedAt ? repository : current;
    byId.set(repository.id, {
      ...newer,
      sources: unique([...current.sources, ...repository.sources]),
      contributionCounts: addContributionCounts(
        current.contributionCounts,
        repository.contributionCounts
      ),
      metadataFetchedAt: Math.max(current.metadataFetchedAt, repository.metadataFetchedAt),
    });
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.nameWithOwner.localeCompare(b.nameWithOwner)
  );
}

export function normalizeRepository(
  repository: RawGraphQLRepository,
  source: RepositoryRecord["sources"][number],
  fetchedAt: number,
  contributionCounts: Partial<RepositoryContributionCounts> = {}
): RepositoryRecord {
  const { languages, codeByteTotal } = aggregateLanguages([repository]);
  return {
    id: repository.id,
    name: repository.name,
    nameWithOwner: repository.nameWithOwner,
    owner: repository.owner.login,
    ownerType: repository.owner.__typename || null,
    description: repository.description,
    url: repository.url || null,
    isArchived: repository.isArchived,
    isFork: repository.isFork,
    isPrivate: repository.isPrivate,
    visibility: repository.visibility || null,
    viewerPermission: repository.viewerPermission || null,
    createdAt: repository.createdAt,
    updatedAt: repository.updatedAt,
    pushedAt: repository.pushedAt || null,
    defaultBranchOid: repository.defaultBranchRef?.target?.oid || null,
    stars: repository.stargazers?.totalCount || 0,
    forks: repository.forkCount,
    primaryLanguage: repository.primaryLanguage?.name || null,
    topics: repository.repositoryTopics.nodes.map((node) => node.topic.name),
    languages,
    codeByteTotal,
    sources: [source],
    contributionCounts: {
      commits: contributionCounts.commits || 0,
      issues: contributionCounts.issues || 0,
      pullRequests: contributionCounts.pullRequests || 0,
      pullRequestReviews: contributionCounts.pullRequestReviews || 0,
      repositoryCreations: contributionCounts.repositoryCreations || 0,
    },
    metadataFetchedAt: fetchedAt,
  };
}

async function fetchContributionYear(
  client: GitHubClient,
  scheduler: RequestScheduler,
  createdAt: string,
  year: number,
  currentYear: number,
  cached: CachedContributionYear | undefined
): Promise<CachedContributionYear> {
  const from =
    year === new Date(createdAt).getUTCFullYear()
      ? createdAt
      : `${year}-01-01T00:00:00.000Z`;
  const to =
    year === currentYear
      ? new Date().toISOString()
      : `${year + 1}-01-01T00:00:00.000Z`;

  const data = await fetchContributionYearCore(client, scheduler, from, to, year);
  const fetchedAt = Date.now();
  let summaries = cached?.repositoryContributions ?? [];
  let repositories = cached?.repositories ?? [];
  let enrichmentComplete = false;

  try {
    const enrichment = await fetchContributionYearRepositoryEnrichment(
      client,
      scheduler,
      from,
      to,
      year
    );
    const extracted = extractContributionRepositories(enrichment, Date.now());
    summaries = extracted.summaries;
    repositories = extracted.repositories;
    enrichmentComplete = true;
  } catch {
    console.warn(
      `Repository contribution enrichment is incomplete for ${year}; it will be retried`
    );
  }

  return {
    year: String(year),
    from,
    to,
    fetchedAt,
    immutable: year < currentYear - 1 && enrichmentComplete,
    enrichmentComplete,
    data,
    repositoryContributions: summaries,
    repositories,
  };
}

async function fetchContributionYearCore(
  client: GitHubClient,
  scheduler: RequestScheduler,
  from: string,
  to: string,
  year: number
): Promise<ContributionsCollection> {
  const target = userQueryTarget(client, ["$from: DateTime!", "$to: DateTime!"]);
  const response = await scheduler.graphql(
    `contribution year ${year} core`,
    () =>
      client.graphqlQuery(
        `query contributionYearCore${target.declaration} {
          ${target.field} {
            contributionsCollection(from: $from, to: $to) {
              totalCommitContributions
              restrictedContributionsCount
              totalIssueContributions
              totalRepositoryContributions
              totalPullRequestContributions
              totalPullRequestReviewContributions
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    contributionCount
                    date
                  }
                }
              }
            }
          }
          ${RATE_LIMIT_FIELDS}
        }`,
        { ...target.variables, from, to }
      ) as Promise<GraphQLResponse<{ viewer: { contributionsCollection: ContributionsCollection } }>>,
    false
  );

  return response.viewer.contributionsCollection;
}

async function fetchContributionYearRepositoryEnrichment(
  client: GitHubClient,
  scheduler: RequestScheduler,
  from: string,
  to: string,
  year: number
): Promise<ContributionRepositoryEnrichment> {
  const target = userQueryTarget(client, ["$from: DateTime!", "$to: DateTime!"]);
  const response = await scheduler.graphql(
    `contribution year ${year} repository enrichment`,
    () =>
      client.graphqlQuery(
        `query contributionYearRepositoryEnrichment${target.declaration} {
          ${target.field} {
            contributionsCollection(from: $from, to: $to) {
              commitContributionsByRepository(maxRepositories: 100) {
                repository {
                  ${REPO_FIELDS}
                }
                contributions(first: 1) {
                  totalCount
                }
              }
              issueContributionsByRepository(maxRepositories: 100) {
                repository {
                  ${REPO_FIELDS}
                }
                contributions(first: 1) {
                  totalCount
                }
              }
              pullRequestContributionsByRepository(maxRepositories: 100) {
                repository {
                  ${REPO_FIELDS}
                }
                contributions(first: 1) {
                  totalCount
                }
              }
              pullRequestReviewContributionsByRepository(maxRepositories: 100) {
                repository {
                  ${REPO_FIELDS}
                }
                contributions(first: 1) {
                  totalCount
                }
              }
              repositoryContributions(first: 100) {
                nodes {
                  repository {
                    ${REPO_FIELDS}
                  }
                }
                totalCount
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
          ${RATE_LIMIT_FIELDS}
        }`,
        { ...target.variables, from, to }
      ) as Promise<GraphQLResponse<{ viewer: { contributionsCollection: ContributionRepositoryEnrichment } }>>,
    true,
    2
  );

  return response.viewer.contributionsCollection;
}

function extractContributionRepositories(
  collection: ContributionRepositoryEnrichment,
  fetchedAt: number
): {
  summaries: RepositoryContributionSummary[];
  repositories: RepositoryRecord[];
} {
  const repositories: RepositoryRecord[] = [];
  const summaryMap = new Map<string, RepositoryContributionSummary>();

  function add(
    group: GraphQLContributionRepositoryGroup,
    key: keyof RepositoryContributionCounts
  ): void {
    const counts: Partial<RepositoryContributionCounts> = {
      [key]: group.contributions.totalCount,
    };
    const repository = normalizeRepository(
      group.repository,
      "profile-contribution",
      fetchedAt,
      counts
    );
    repositories.push(repository);
    mergeContributionSummary(summaryMap, repository);
  }

  for (const group of collection.commitContributionsByRepository) add(group, "commits");
  for (const group of collection.issueContributionsByRepository) add(group, "issues");
  for (const group of collection.pullRequestContributionsByRepository) {
    add(group, "pullRequests");
  }
  for (const group of collection.pullRequestReviewContributionsByRepository) {
    add(group, "pullRequestReviews");
  }
  for (const node of collection.repositoryContributions.nodes) {
    const repository = normalizeRepository(
      node.repository,
      "profile-contribution",
      fetchedAt,
      { repositoryCreations: 1 }
    );
    repositories.push(repository);
    mergeContributionSummary(summaryMap, repository);
  }

  return {
    summaries: Array.from(summaryMap.values()).sort((a, b) =>
      a.nameWithOwner.localeCompare(b.nameWithOwner)
    ),
    repositories: mergeRepositories(repositories),
  };
}

async function materializeDiscoveredRepositories(
  client: GitHubClient,
  scheduler: RequestScheduler,
  cache: StableCache,
  discovered: RepositoryDiscoveryWithSource[],
  fetchedAt: number,
  knownRepositories: RepositoryRecord[]
): Promise<{ repositories: RepositoryRecord[]; fetched: number; reused: number }> {
  const byId = new Map<
    string,
    { repository: RepositoryDiscovery | null; sources: RepositoryRecord["sources"] }
  >();

  for (const item of discovered) {
    const current = byId.get(item.repository.id);
    if (current) {
      current.sources = addSource(current.sources, item.source);
      current.repository = item.repository;
    } else {
      byId.set(item.repository.id, {
        repository: item.repository,
        sources: [item.source],
      });
    }
  }

  // Historical repositories must be revalidated, not assumed to still be public or accessible.
  for (const repository of knownRepositories) {
    const current = byId.get(repository.id);
    if (current) {
      current.sources = unique([...current.sources, ...repository.sources]);
    } else {
      byId.set(repository.id, { repository: null, sources: repository.sources });
    }
  }

  const repositories: RepositoryRecord[] = [];
  const idsToFetch: string[] = [];
  let reused = 0;
  for (const [id, item] of byId) {
    const cached = cache.repositories[id]?.repository;
    if (cached && item.repository && !repositoryDiscoveryChanged(cached, item.repository)) {
      repositories.push({
        ...metadataOnlyRepository(cached),
        sources: unique([...cached.sources, ...item.sources]),
        metadataFetchedAt: fetchedAt,
      });
      reused++;
    } else {
      idsToFetch.push(id);
    }
  }

  for (let i = 0; i < idsToFetch.length; i += 50) {
    const batchIds = idsToFetch.slice(i, i + 50);
    const details = await fetchRepositoryDetails(client, scheduler, batchIds);
    for (const detail of details) {
      const sourceInfo = byId.get(detail.id);
      if (!sourceInfo) continue;
      const normalized = normalizeRepository(
        detail,
        sourceInfo.sources[0] || "contributed",
        fetchedAt
      );
      repositories.push({
        ...normalized,
        sources: unique([...normalized.sources, ...sourceInfo.sources]),
      });
    }
  }

  return {
    repositories,
    fetched: idsToFetch.length,
    reused,
  };
}

async function fetchRepositoryDetails(
  client: GitHubClient,
  scheduler: RequestScheduler,
  ids: string[]
): Promise<RawGraphQLRepository[]> {
  if (ids.length === 0) return [];
  const response = await scheduler.graphql(
    "repository details",
    () =>
      client.graphqlQuery(
        `query repositoryDetails($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Repository {
              ${REPO_FIELDS}
            }
          }
          ${RATE_LIMIT_FIELDS}
        }`,
        { ids },
        { allowMissingNodes: true }
      ) as Promise<GraphQLResponse<{ nodes: Array<RawGraphQLRepository | null> }>>,
    false
  );

  return response.nodes.filter((node): node is RawGraphQLRepository => Boolean(node));
}

function repositoryDiscoveryChanged(
  cached: RepositoryRecord,
  discovered: RepositoryDiscovery
): boolean {
  return (
    cached.nameWithOwner !== discovered.nameWithOwner ||
    cached.isPrivate !== discovered.isPrivate ||
    cached.visibility !== (discovered.visibility || null) ||
    cached.viewerPermission !== (discovered.viewerPermission || null) ||
    cached.updatedAt !== discovered.updatedAt ||
    cached.pushedAt !== (discovered.pushedAt || null) ||
    cached.defaultBranchOid !== (discovered.defaultBranchRef?.target?.oid || null)
  );
}

async function paginateRepositoryDiscoveryConnection<T extends { rateLimit?: RateLimitInfo }>(
  label: string,
  scheduler: RequestScheduler,
  request: (cursor: string | null) => Promise<T>,
  getConnection: (response: T) => RepositoryDiscoveryConnection
): Promise<RepositoryDiscovery[]> {
  const repositories: RepositoryDiscovery[] = [];
  let cursor: string | null = null;

  do {
    const response = await scheduler.graphql(label, () => request(cursor), false);
    const connection = getConnection(response);
    repositories.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (cursor);

  return repositories;
}

async function fetchContributorStats(
  client: GitHubClient,
  scheduler: RequestScheduler,
  volatileCache: VolatileCache,
  cached: ContributorStatsSummary | undefined,
  repo: RepositoryRecord,
  username: string
): Promise<ContributorStatsSummary> {
  const [owner, repoName] = repo.nameWithOwner.split("/");
  const etagKey = `contributors:${repo.id}:${repo.defaultBranchOid || "none"}`;
  const hasCachedValue = cached &&
    cached.defaultBranchOid === repo.defaultBranchOid &&
    ["fresh", "cached"].includes(cached.status);
  const headers = hasCachedValue ? conditionalHeaders(volatileCache, etagKey) : undefined;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0 && !scheduler.shouldStartOptional("rest")) break;
    const response = await scheduler.rest(
      "repository contributor stats",
      () =>
        client.restGetRaw(`/repos/${owner}/${repoName}/stats/contributors`, undefined, headers),
      true
    );

    if (response.status === 202) {
      if (attempt < 3) {
        await delay(Math.min(8000, 1000 * Math.pow(2, attempt)));
      }
      continue;
    }

    if (response.status === 304) {
      if (!hasCachedValue) {
        delete volatileCache.restEtags[etagKey];
        throw new Error("Unchanged contributor response has no matching cached metrics");
      }
      rememberEtag(volatileCache, etagKey, response.headers);
      return { ...cached, status: "cached", fetchedAt: Date.now() };
    }

    const parsed = contributorResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      throw new Error("Invalid GitHub contributor statistics response");
    }
    const userStats = parsed.data.find(
      (contributor) => contributor.author?.login.toLowerCase() === username.toLowerCase()
    );
    let additions = 0;
    let deletions = 0;
    let commits = 0;
    for (const week of userStats?.weeks ?? []) {
      additions += week.a;
      deletions += week.d;
      commits += week.c;
    }

    rememberEtag(volatileCache, etagKey, response.headers);
    return {
      additions,
      deletions,
      commits,
      fetchedAt: Date.now(),
      defaultBranchOid: repo.defaultBranchOid,
      status: "fresh",
    };
  }

  return {
    additions: 0,
    deletions: 0,
    commits: 0,
    fetchedAt: Date.now(),
    defaultBranchOid: repo.defaultBranchOid,
    ...cached,
    status: "pending",
    error: "GitHub is still computing contributor stats (202)",
  };
}

async function fetchTraffic(
  client: GitHubClient,
  scheduler: RequestScheduler,
  volatileCache: VolatileCache,
  cached: CachedTraffic | undefined,
  repo: RepositoryRecord
): Promise<CachedTraffic> {
  const [owner, repoName] = repo.nameWithOwner.split("/");
  const etagKey = `traffic:${repo.id}`;
  const hasCachedValue = cached && ["fresh", "cached"].includes(cached.status);
  const headers = hasCachedValue ? conditionalHeaders(volatileCache, etagKey) : undefined;
  const response = await scheduler.rest(
    "repository traffic",
    () =>
      client.restGetRaw(`/repos/${owner}/${repoName}/traffic/views`, { per: "day" }, headers),
    true
  );

  if (response.status === 202) {
    return {
      count: 0,
      uniques: 0,
      days: [],
      fetchedAt: Date.now(),
      ...cached,
      status: "pending",
      error: "GitHub is still computing traffic (202)",
    };
  }
  if (response.status === 304) {
    if (!hasCachedValue) {
      delete volatileCache.restEtags[etagKey];
      throw new Error("Unchanged traffic response has no matching cached metrics");
    }
    rememberEtag(volatileCache, etagKey, response.headers);
    return { ...cached, status: "cached", fetchedAt: Date.now() };
  }

  const parsed = trafficResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error("Invalid GitHub traffic response");
  }
  rememberEtag(volatileCache, etagKey, response.headers);
  return {
    count: parsed.data.count,
    uniques: parsed.data.uniques,
    days: mergeTrafficDays(cached?.days ?? [], parsed.data.views),
    fetchedAt: Date.now(),
    status: "fresh",
  };
}

function mergeRepositoryContributions(
  summaries: RepositoryContributionSummary[]
): RepositoryContributionSummary[] {
  const byId = new Map<string, RepositoryContributionSummary>();
  for (const summary of summaries) {
    const current = byId.get(summary.repositoryId);
    if (!current) {
      byId.set(summary.repositoryId, { ...summary, counts: { ...summary.counts } });
      continue;
    }
    current.counts = addContributionCounts(current.counts, summary.counts);
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.nameWithOwner.localeCompare(b.nameWithOwner)
  );
}

function mergeContributionSummary(
  summaryMap: Map<string, RepositoryContributionSummary>,
  repository: RepositoryRecord
): void {
  const current = summaryMap.get(repository.id);
  if (!current) {
    summaryMap.set(repository.id, {
      repositoryId: repository.id,
      nameWithOwner: repository.nameWithOwner,
      owner: repository.owner,
      counts: { ...repository.contributionCounts },
    });
    return;
  }
  current.counts = addContributionCounts(current.counts, repository.contributionCounts);
}

function addContributionCounts(
  a: RepositoryContributionCounts,
  b: RepositoryContributionCounts
): RepositoryContributionCounts {
  return {
    commits: a.commits + b.commits,
    issues: a.issues + b.issues,
    pullRequests: a.pullRequests + b.pullRequests,
    pullRequestReviews: a.pullRequestReviews + b.pullRequestReviews,
    repositoryCreations: a.repositoryCreations + b.repositoryCreations,
  };
}

function addSource(
  sources: RepositoryRecord["sources"],
  source: RepositoryRecord["sources"][number]
): RepositoryRecord["sources"] {
  return unique([...sources, source]);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function userQueryTarget(client: GitHubClient, variableDefinitions: string[] = []) {
  const login = client.targetUsername;
  const definitions = login
    ? ["$login: String!", ...variableDefinitions]
    : variableDefinitions;
  return {
    declaration: definitions.length > 0 ? `(${definitions.join(", ")})` : "",
    field: login ? "viewer: user(login: $login)" : "viewer",
    variables: login ? { login } : {},
  };
}

function getRepositoryPriority(repo: RepositoryRecord): number {
  let priority = 50;
  if (repo.sources.includes("owned")) priority -= 30;
  if (repo.sources.includes("profile-contribution")) priority -= 20;
  if (repo.sources.includes("contributed")) priority -= 10;
  if (repo.isArchived) priority += 40;
  if (repo.pushedAt?.startsWith(String(new Date().getUTCFullYear()))) priority -= 10;
  return Math.max(1, priority);
}

function canReadTraffic(repo: RepositoryRecord): boolean {
  return ["ADMIN", "MAINTAIN", "WRITE"].includes(repo.viewerPermission || "");
}

function mergeTrafficDays(existing: TrafficDay[], next: TrafficDay[]): TrafficDay[] {
  const byTimestamp = new Map<string, TrafficDay>();
  for (const day of existing) byTimestamp.set(day.timestamp, day);
  for (const day of next) byTimestamp.set(day.timestamp, day);
  return Array.from(byTimestamp.values()).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );
}

function conditionalHeaders(
  volatileCache: VolatileCache,
  key: string
): Record<string, string> | undefined {
  const cached = volatileCache.restEtags[key];
  if (!cached?.etag && !cached?.lastModified) return undefined;
  return {
    ...(cached.etag ? { "If-None-Match": cached.etag } : {}),
    ...(cached.lastModified ? { "If-Modified-Since": cached.lastModified } : {}),
  };
}

function rememberEtag(
  volatileCache: VolatileCache,
  key: string,
  headers: Record<string, string | number | undefined>
): void {
  const etag = typeof headers.etag === "string" ? headers.etag : undefined;
  const lastModified =
    typeof headers["last-modified"] === "string" ? headers["last-modified"] : undefined;
  if (!etag && !lastModified) return;
  volatileCache.restEtags[key] = {
    etag,
    lastModified,
    updatedAt: Date.now(),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
