import type {
  ActivityStats,
  CollectionStatus,
  ContributionData,
  ContributionsCollection,
  ContributionWeek,
  GitHubStatsOutput,
  PackageMetrics,
  PrivacyReport,
  ProfileContributions,
  RepoMetrics,
  RepositoryContributionSummary,
  RepositoryRecord,
  UserProfile,
} from "./v2.js";
import {
  aggregateRepositoryLanguages,
  calculateComputedStats,
  calculateContributionStats,
  calculateRepoStats,
} from "./aggregate.js";
import { buildPresentationData } from "./presentation.js";

// Merges canonical v2 outputs (multi-profile collection, or a renderer pulling
// several stats documents). Derived blocks (calendar, streaks, repo metrics,
// presentation) are recomputed from the merged primitives so every view of the
// output stays consistent.
export function mergeStatsOutputs(outputs: GitHubStatsOutput[]): GitHubStatsOutput {
  if (outputs.length === 0) {
    throw new Error("mergeStatsOutputs requires at least one output");
  }
  if (outputs.length === 1) {
    return outputs[0];
  }

  const repositories = mergeRepositories(outputs.flatMap((output) => output.repositories));
  const profileContributions = mergeProfileContributions(
    outputs.map((output) => output.profileContributions)
  );
  const activity = mergeActivity(outputs.map((output) => output.activity));
  const repoMetrics = mergeRepoMetrics(outputs, repositories);
  const privacy = mergePrivacy(outputs);
  const collectionStatus = mergeCollectionStatus(outputs);
  const packageMetrics = mergePackageMetrics(outputs.map((output) => output.packageMetrics));

  const generatedAt = outputs
    .map((output) => output.generatedAt)
    .reduce((latest, at) => (at > latest ? at : latest));
  const fetchedAt = Date.parse(generatedAt);

  const profile = pickPrimaryProfile(outputs);

  const presentation = buildPresentationData({
    profile,
    profileContributions,
    repoMetrics,
    complete: outputs.every((output) => output.collectionStatus.complete),
    fetchedAt,
  });

  return {
    schemaVersion: outputs[0].schemaVersion,
    generatedAt,
    profile,
    profileContributions,
    activity,
    repositories,
    repoMetrics,
    packageMetrics,
    presentation,
    privacy,
    collectionStatus,
  };
}

function pickPrimaryProfile(outputs: GitHubStatsOutput[]): UserProfile {
  return outputs[0].profile;
}

export function mergeProfileContributions(
  contributions: ProfileContributions[]
): ProfileContributions {
  const calendar = mergeContributionCalendars(
    contributions.map((c) => c.contributionCalendar)
  );
  const collection: ContributionsCollection = {
    totalCommitContributions: contributions.reduce(
      (sum, c) => sum + c.totalCommitContributions,
      0
    ),
    restrictedContributionsCount: contributions.reduce(
      (sum, c) => sum + c.restrictedContributionsCount,
      0
    ),
    totalIssueContributions: contributions.reduce(
      (sum, c) => sum + c.totalIssueContributions,
      0
    ),
    totalRepositoryContributions: contributions.reduce(
      (sum, c) => sum + c.totalRepositoryContributions,
      0
    ),
    totalPullRequestContributions: contributions.reduce(
      (sum, c) => sum + c.totalPullRequestContributions,
      0
    ),
    totalPullRequestReviewContributions: contributions.reduce(
      (sum, c) => sum + c.totalPullRequestReviewContributions,
      0
    ),
    contributionCalendar: calendar,
  };

  return {
    totalContributions: calendar.totalContributions,
    totalCommitContributions: collection.totalCommitContributions,
    restrictedContributionsCount: collection.restrictedContributionsCount,
    totalIssueContributions: collection.totalIssueContributions,
    totalRepositoryContributions: collection.totalRepositoryContributions,
    totalPullRequestContributions: collection.totalPullRequestContributions,
    totalPullRequestReviewContributions: collection.totalPullRequestReviewContributions,
    contributionCalendar: calendar,
    stats: calculateContributionStats(collection),
    repositoryContributions: mergeRepositoryContributionSummaries(
      contributions.flatMap((c) => c.repositoryContributions)
    ),
    completeness: {
      complete: contributions.every((c) => c.completeness.complete),
      yearsFetched: unionSorted(contributions.map((c) => c.completeness.yearsFetched)),
      yearsFromCache: unionSorted(contributions.map((c) => c.completeness.yearsFromCache)),
      // A year is only missing when every output is missing it.
      missingYears: intersectSorted(contributions.map((c) => c.completeness.missingYears)),
    },
  };
}

// GitHub calendars are contiguous daily weeks anchored on Sunday. Merging by
// date and re-chunking from the first day keeps that layout for any profile
// span, including accounts created in different years.
export function mergeContributionCalendars(calendars: ContributionsCollection["contributionCalendar"][]) {
  const byDate = new Map<string, number>();
  for (const calendar of calendars) {
    for (const week of calendar.weeks) {
      for (const day of week.contributionDays) {
        byDate.set(day.date, (byDate.get(day.date) || 0) + day.contributionCount);
      }
    }
  }

  const days: ContributionData[] = Array.from(byDate.entries())
    .map(([date, contributionCount]) => ({ date, contributionCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weeks: ContributionWeek[] = [];
  let currentWeek: ContributionData[] = [];
  for (const day of days) {
    const weekday = new Date(`${day.date}T00:00:00.000Z`).getUTCDay();
    if (weekday === 0 && currentWeek.length > 0) {
      weeks.push({ contributionDays: currentWeek });
      currentWeek = [];
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) {
    weeks.push({ contributionDays: currentWeek });
  }

  return {
    totalContributions: days.reduce((sum, day) => sum + day.contributionCount, 0),
    weeks,
  };
}

function mergeActivity(activities: ActivityStats[]): ActivityStats {
  const sum = (pick: (activity: ActivityStats) => number) =>
    activities.reduce((total, activity) => total + pick(activity), 0);

  return {
    totalPullRequests: sum((a) => a.totalPullRequests),
    openIssues: sum((a) => a.openIssues),
    closedIssues: sum((a) => a.closedIssues),
    repositoriesContributedTo: sum((a) => a.repositoriesContributedTo),
    discussionsStarted: sum((a) => a.discussionsStarted),
    discussionsAnswered: sum((a) => a.discussionsAnswered),
    starsGiven: sum((a) => a.starsGiven),
  };
}

function mergeRepositories(repositories: RepositoryRecord[]): RepositoryRecord[] {
  const byId = new Map<string, RepositoryRecord>();
  for (const repository of repositories) {
    const current = byId.get(repository.id);
    if (!current) {
      byId.set(repository.id, { ...repository, sources: [...new Set(repository.sources)] });
      continue;
    }
    const newer =
      repository.metadataFetchedAt >= current.metadataFetchedAt ? repository : current;
    byId.set(repository.id, {
      ...newer,
      sources: [...new Set([...current.sources, ...repository.sources])],
      contributionCounts: {
        commits: current.contributionCounts.commits + repository.contributionCounts.commits,
        issues: current.contributionCounts.issues + repository.contributionCounts.issues,
        pullRequests:
          current.contributionCounts.pullRequests + repository.contributionCounts.pullRequests,
        pullRequestReviews:
          current.contributionCounts.pullRequestReviews +
          repository.contributionCounts.pullRequestReviews,
        repositoryCreations:
          current.contributionCounts.repositoryCreations +
          repository.contributionCounts.repositoryCreations,
      },
      metadataFetchedAt: Math.max(current.metadataFetchedAt, repository.metadataFetchedAt),
    });
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.nameWithOwner.localeCompare(b.nameWithOwner)
  );
}

export function mergeRepositoryContributionSummaries(
  summaries: RepositoryContributionSummary[]
): RepositoryContributionSummary[] {
  const byId = new Map<string, RepositoryContributionSummary>();
  for (const summary of summaries) {
    const current = byId.get(summary.repositoryId);
    if (!current) {
      byId.set(summary.repositoryId, { ...summary, counts: { ...summary.counts } });
      continue;
    }
    current.counts = {
      commits: current.counts.commits + summary.counts.commits,
      issues: current.counts.issues + summary.counts.issues,
      pullRequests: current.counts.pullRequests + summary.counts.pullRequests,
      pullRequestReviews: current.counts.pullRequestReviews + summary.counts.pullRequestReviews,
      repositoryCreations: current.counts.repositoryCreations + summary.counts.repositoryCreations,
    };
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.nameWithOwner.localeCompare(b.nameWithOwner)
  );
}

function mergeRepoMetrics(
  outputs: GitHubStatsOutput[],
  repositories: RepositoryRecord[]
): RepoMetrics {
  const ownedOriginal = repositories.filter(
    (repo) => repo.sources.includes("owned") && !repo.isFork
  );
  const { languages: topLanguages, codeByteTotal } =
    aggregateRepositoryLanguages(repositories);
  const profileLanguages = aggregateRepositoryLanguages(ownedOriginal);
  const computedRepos = repositories.map(toComputedRepo);
  const mergedCalendar = mergeContributionCalendars(
    outputs.map((output) => output.profileContributions.contributionCalendar)
  );
  const contributionStats = calculateContributionStats({
    totalCommitContributions: 0,
    restrictedContributionsCount: 0,
    totalIssueContributions: 0,
    totalRepositoryContributions: 0,
    totalPullRequestContributions: 0,
    totalPullRequestReviewContributions: 0,
    contributionCalendar: mergedCalendar,
  });
  const computedStats = calculateComputedStats(computedRepos, topLanguages, contributionStats);

  const sumOver = <K extends keyof RepoMetrics & string>(key: K, field: string): number =>
    outputs.reduce(
      (total, output) =>
        total + ((output.repoMetrics[key] as unknown as Record<string, number>)[field] ?? 0),
      0
    );

  return {
    starCount: ownedOriginal.reduce((sum, repo) => sum + repo.stars, 0),
    forkCount: ownedOriginal.reduce((sum, repo) => sum + repo.forks, 0),
    codeByteTotal,
    topLanguages,
    topTopics: computedStats.topTopics,
    profile: {
      totalRepos: sumOver("profile", "totalRepos") || undefined,
      publicRepos: sumOver("profile", "publicRepos"),
      privateRepos: sumOver("profile", "privateRepos"),
      originalRepos: sumOver("profile", "originalRepos"),
      forkedRepos: sumOver("profile", "forkedRepos"),
      activeOriginalRepos: sumOver("profile", "activeOriginalRepos"),
      archivedOriginalRepos: sumOver("profile", "archivedOriginalRepos"),
      reposWithStars: sumOver("profile", "reposWithStars"),
      starsReceived: sumOver("profile", "starsReceived"),
      forksReceived: sumOver("profile", "forksReceived"),
      codeByteTotal: profileLanguages.codeByteTotal,
      topLanguages: profileLanguages.languages,
    },
    contributorStats: {
      totalCommits: sumOver("contributorStats", "totalCommits"),
      linesAdded: sumOver("contributorStats", "linesAdded"),
      linesDeleted: sumOver("contributorStats", "linesDeleted"),
      linesOfCodeChanged: sumOver("contributorStats", "linesOfCodeChanged"),
      reposCompleted: sumOver("contributorStats", "reposCompleted"),
      reposPending: sumOver("contributorStats", "reposPending"),
      reposFailed: sumOver("contributorStats", "reposFailed"),
    },
    traffic: {
      repoViews: sumOver("traffic", "repoViews"),
      repoViewUniques: sumOver("traffic", "repoViewUniques"),
      reposCompleted: sumOver("traffic", "reposCompleted"),
      reposPending: sumOver("traffic", "reposPending"),
      reposFailed: sumOver("traffic", "reposFailed"),
    },
    repoStats: calculateRepoStats(computedRepos),
    computedStats,
  };
}

function toComputedRepo(repo: RepositoryRecord) {
  return {
    ...repo,
    languages: {
      edges: repo.languages.map((language) => ({
        size: language.value,
        node: {
          name: language.languageName,
          color: language.color,
        },
      })),
    },
  };
}

function mergePrivacy(outputs: GitHubStatsOutput[]): PrivacyReport {
  const sum = (pick: (privacy: PrivacyReport) => number) =>
    outputs.reduce((total, output) => total + pick(output.privacy), 0);

  return {
    privateRepositoryMetricsIncluded: outputs.some(
      (output) => output.privacy.privateRepositoryMetricsIncluded
    ),
    privateRepositoryDetailsIncluded: outputs.some(
      (output) => output.privacy.privateRepositoryDetailsIncluded
    ),
    privateCacheDetailsIncluded: outputs.some(
      (output) => output.privacy.privateCacheDetailsIncluded
    ),
    redactedPrivateRepositories: sum((p) => p.redactedPrivateRepositories),
    redactedRepositoryContributions: sum((p) => p.redactedRepositoryContributions),
    redactedOptionalMetrics: sum((p) => p.redactedOptionalMetrics),
  };
}

function mergeCollectionStatus(outputs: GitHubStatsOutput[]): CollectionStatus {
  const [first] = outputs;
  const startedAt = Math.min(...outputs.map((output) => output.collectionStatus.startedAt));
  const finishedAt = Math.max(...outputs.map((output) => output.collectionStatus.finishedAt));

  return {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    complete: outputs.every((output) => output.collectionStatus.complete),
    coreComplete: outputs.every((output) => output.collectionStatus.coreComplete),
    cache: {
      stablePath: first.collectionStatus.cache.stablePath,
      volatilePath: first.collectionStatus.cache.volatilePath,
      contributionYearsFromCache: outputs.reduce(
        (sum, output) => sum + output.collectionStatus.cache.contributionYearsFromCache,
        0
      ),
      contributionYearsFetched: outputs.reduce(
        (sum, output) => sum + output.collectionStatus.cache.contributionYearsFetched,
        0
      ),
      repositoriesFromCache: outputs.reduce(
        (sum, output) => sum + output.collectionStatus.cache.repositoriesFromCache,
        0
      ),
      repositoriesFetched: outputs.reduce(
        (sum, output) => sum + output.collectionStatus.cache.repositoriesFetched,
        0
      ),
    },
    backfill: {
      enabled: outputs.some((output) => output.collectionStatus.backfill.enabled),
      completedThisRun: outputs.reduce(
        (sum, output) => sum + output.collectionStatus.backfill.completedThisRun,
        0
      ),
      pending: outputs.reduce(
        (sum, output) => sum + output.collectionStatus.backfill.pending,
        0
      ),
      failedThisRun: outputs.reduce(
        (sum, output) => sum + output.collectionStatus.backfill.failedThisRun,
        0
      ),
      skippedThisRun: outputs.reduce(
        (sum, output) => sum + output.collectionStatus.backfill.skippedThisRun,
        0
      ),
    },
    rateLimit: first.collectionStatus.rateLimit,
    warnings: unionSorted(outputs.map((output) => output.collectionStatus.warnings)),
    errors: unionSorted(outputs.map((output) => output.collectionStatus.errors)),
  };
}

function mergePackageMetrics(metrics: PackageMetrics[]): PackageMetrics {
  const packages = new Map(
    metrics
      .flatMap((metric) => metric.packages)
      .map((item) => [`${item.provider}:${item.name}`, item])
  );
  const values = Array.from(packages.values());
  const sumDownloads = (period: keyof PackageMetrics["downloads"]) =>
    values.reduce((total, item) => total + item.downloads[period], 0);

  return {
    packageCount: values.length,
    providers: [...new Set(metrics.flatMap((metric) => metric.providers))].sort(),
    downloads: {
      lastDay: sumDownloads("lastDay"),
      lastWeek: sumDownloads("lastWeek"),
      lastMonth: sumDownloads("lastMonth"),
      lastYear: sumDownloads("lastYear"),
      allTime: sumDownloads("allTime"),
    },
    packages: values.sort((a, b) => b.downloads.lastMonth - a.downloads.lastMonth),
    complete: metrics.every((metric) => metric.complete),
    warnings: [...new Set(metrics.flatMap((metric) => metric.warnings))],
  };
}

function unionSorted(lists: string[][]): string[] {
  return [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b));
}

function intersectSorted(lists: string[][]): string[] {
  if (lists.length === 0) return [];
  const [first, ...rest] = lists;
  return first
    .filter((value) => rest.every((list) => list.includes(value)))
    .sort((a, b) => a.localeCompare(b));
}
