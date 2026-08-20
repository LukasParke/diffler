import {
  githubStatsOutputSchema,
  type GitHubStatsOutput,
} from '@lukasparke/diffler-schemas';
import {RenderLanguage, UserStats, MetricCard} from './schemas';

type UnknownRecord = Record<string, unknown>;

export function normalizeGithubStats(
  rawValue: unknown,
  options: {allowPrivateRepositoryDetails: boolean}
): UserStats {
  const raw = asRecord(rawValue);

  assertPublicSafe(raw, options.allowPrivateRepositoryDetails);

  // Canonical v2 documents validate strictly and map directly from typed
  // fields. Anything older (sparse v2 files or pre-v2 legacy JSON) falls back
  // to the defensive normalizers below.
  const parsed = githubStatsOutputSchema.safeParse(raw);
  if (parsed.success) {
    return userStatsFromCanonical(parsed.data);
  }

  if (asNumber(raw.schemaVersion, null) === 2) {
    return normalizeV2Stats(raw);
  }

  return normalizeLegacyStats(raw);
}

// Maps a schema-validated canonical v2 output to the card view. Every field is
// typed, so this is a plain projection — no coercion.
function userStatsFromCanonical(output: GitHubStatsOutput): UserStats {
  const profileMetrics = output.repoMetrics.profile;
  const contributionStats = output.profileContributions.stats;
  const activity = output.activity;
  const contributorStats = output.repoMetrics.contributorStats;
  const traffic = output.repoMetrics.traffic;
  const generatedAt = output.generatedAt;
  const fetchedAt =
    Date.parse(generatedAt) ||
    output.collectionStatus.startedAt ||
    Date.now();
  const totalContributions = output.profileContributions.totalContributions;
  const starCount = profileMetrics?.starsReceived ?? 0;
  const forkCount = profileMetrics?.forksReceived ?? 0;
  const totalRepos = profileMetrics?.totalRepos ?? output.repoMetrics.repoStats.totalRepos;
  const publicRepos =
    profileMetrics?.publicRepos ?? output.repoMetrics.repoStats.publicRepos;
  const activeRepos =
    profileMetrics?.activeOriginalRepos ?? output.repoMetrics.repoStats.activeRepos;
  const linesAdded = contributorStats.linesAdded;
  const linesDeleted = contributorStats.linesDeleted;
  const linesOfCodeChanged = contributorStats.linesOfCodeChanged;
  const linesChanged = linesOfCodeChanged;
  const trafficCompleted = traffic.reposCompleted;
  const repoViews = trafficCompleted > 0 ? traffic.repoViews : null;
  const repoViewUniques = trafficCompleted > 0 ? traffic.repoViewUniques : null;
  const backfillPending = output.collectionStatus.backfill.pending;
  const isComplete =
    output.presentation.readmeSummary.complete ||
    (output.collectionStatus.complete && backfillPending === 0);
  const totalCommits =
    contributorStats.totalCommits || output.profileContributions.totalCommitContributions;

  return {
    schemaVersion: 2,
    name: output.profile.name || output.profile.login || 'GitHub User',
    username: output.profile.login || 'unknown',
    avatarUrl: output.profile.avatarUrl,
    bio: output.profile.bio,
    websiteUrl: output.profile.websiteUrl,
    location: output.profile.location,
    generatedAt,
    fetchedAt,
    isComplete,
    summary: {
      totalContributions,
      currentStreak: contributionStats.currentStreak,
      longestStreak: contributionStats.longestStreak,
      starsReceived: starCount,
      forksReceived: forkCount,
      activeRepos,
      totalRepos,
      languageCount:
        profileMetrics?.topLanguages.length ?? output.repoMetrics.computedStats.languageCount,
      profileMetricsComplete: profileMetrics != null,
      refreshedAt: output.presentation.readmeSummary.refreshedAt || generatedAt,
    },
    contributions: {
      totalContributions,
      totalCommits,
      restrictedContributionsCount: output.profileContributions.restrictedContributionsCount,
      currentStreak: contributionStats.currentStreak,
      longestStreak: contributionStats.longestStreak,
      peakDay: contributionStats.peakDay,
      mostProductiveMonth: output.repoMetrics.computedStats.mostProductiveMonth,
      calendar: flattenContributionCalendar(
        output.profileContributions.contributionCalendar
      ),
      timeline:
        output.presentation.timeline.length > 0
          ? output.presentation.timeline
          : contributionStats.yearlyBreakdown.map((year) => ({
              period: year.year,
              contributions: year.contributions,
            })),
    },
    code: {
      codeByteTotal: profileMetrics?.codeByteTotal ?? output.repoMetrics.codeByteTotal,
      linesAdded,
      linesDeleted,
      linesChanged,
      linesOfCodeChanged,
      contributorReposCompleted: contributorStats.reposCompleted,
      contributorReposPending: contributorStats.reposPending,
      contributorReposFailed: contributorStats.reposFailed,
    },
    community: {
      totalPullRequests: activity.totalPullRequests,
      totalPullRequestReviews:
        output.profileContributions.totalPullRequestReviewContributions,
      openIssues: activity.openIssues,
      closedIssues: activity.closedIssues,
      repositoriesContributedTo: activity.repositoriesContributedTo,
      discussionsStarted: activity.discussionsStarted,
      discussionsAnswered: activity.discussionsAnswered,
      starsGiven: activity.starsGiven,
      followers: output.profile.followers,
      following: output.profile.following,
    },
    repositories: {
      totalRepos,
      publicRepos,
      privateRepos: profileMetrics?.privateRepos ?? Math.max(0, totalRepos - publicRepos),
      activeRepos,
      archivedRepos:
        profileMetrics?.archivedOriginalRepos ?? output.repoMetrics.repoStats.archivedRepos,
      forkedRepos: profileMetrics?.forkedRepos ?? output.repoMetrics.repoStats.forkedRepos,
      originalRepos: profileMetrics?.originalRepos ?? output.repoMetrics.repoStats.originalRepos,
      reposWithStars:
        profileMetrics?.reposWithStars ?? output.repoMetrics.repoStats.reposWithStars,
      repoViews,
      repoViewUniques,
      trafficReposCompleted: trafficCompleted,
      trafficReposPending: traffic.reposPending,
      trafficReposFailed: traffic.reposFailed,
      starCount,
      forkCount,
    },
    topLanguages: profileMetrics?.topLanguages ?? [],
    packages: output.packageMetrics,
    cards: output.presentation.cards,
    highlights: output.presentation.highlights,
    privacy: output.privacy,
    collectionStatus: {
      complete: isComplete,
      coreComplete: output.collectionStatus.coreComplete,
      backfillPending,
      backfillCompletedThisRun: output.collectionStatus.backfill.completedThisRun,
      backfillFailedThisRun: output.collectionStatus.backfill.failedThisRun,
      warnings: output.collectionStatus.warnings,
      errors: output.collectionStatus.errors,
    },
    repoViews,
    linesOfCodeChanged,
    linesAdded,
    linesDeleted,
    linesChanged,
    totalCommits,
    totalPullRequests: activity.totalPullRequests,
    totalPullRequestReviews:
      output.profileContributions.totalPullRequestReviewContributions,
    openIssues: activity.openIssues,
    closedIssues: activity.closedIssues,
    forkCount,
    starCount,
    totalContributions,
    codeByteTotal: output.repoMetrics.codeByteTotal,
  };
}

function flattenContributionCalendar(calendar: {
  weeks: Array<{contributionDays: Array<{contributionCount: number; date: string}>}>;
}): Array<{contributionCount: number; date: string}> {
  return calendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({
      contributionCount: day.contributionCount,
      date: day.date,
    }))
  );
}

// Fallback for v2 documents produced before the legacy fields were removed
// (sparse or carrying a `legacy` block). New documents always take the strict
// canonical path above.
function normalizeV2Stats(raw: UnknownRecord): UserStats {
  const profile = asRecord(raw.profile);
  const legacy = asRecord(raw.legacy);
  const presentation = asRecord(raw.presentation);
  const readmeSummary = asRecord(presentation.readmeSummary);
  const profileContributions = asRecord(raw.profileContributions);
  const activity = asRecord(raw.activity);
  const repoMetrics = asRecord(raw.repoMetrics);
  const contributorStats = asRecord(asRecord(repoMetrics.contributorStats));
  const traffic = asRecord(asRecord(repoMetrics.traffic));
  const repoStats = asRecord(asRecord(repoMetrics.repoStats));
  const computedStats = asRecord(asRecord(repoMetrics.computedStats));
  const contributionStats = asRecord(asRecord(legacy.contributionStats));
  const privacy = asRecord(raw.privacy);
  const packageMetrics = asRecord(raw.packageMetrics);
  const collectionStatus = asRecord(raw.collectionStatus);
  const backfill = asRecord(collectionStatus.backfill);
  const fetchedAt = asNumber(
    legacy.fetchedAt,
    Date.parse(asString(raw.generatedAt))
  );
  const generatedAt =
    asString(raw.generatedAt) ||
    new Date(fetchedAt || Date.now()).toISOString();
  const explicitProfileRepoMetrics = asRecord(repoMetrics.profile);
  const hasExplicitProfileRepoMetrics =
    Object.keys(explicitProfileRepoMetrics).length > 0;
  const repositoryCollectionComplete = isRepositoryCollectionComplete(
    raw.repositories,
    repoStats,
    collectionStatus
  );
  const derivedProfileRepoMetrics = repositoryCollectionComplete
    ? deriveProfileRepositoryMetrics(
        raw.repositories,
        asString(profile.login),
        generatedAt.slice(0, 4)
      )
    : {};
  const profileRepoMetrics = {
    ...derivedProfileRepoMetrics,
    ...explicitProfileRepoMetrics
  };
  const profileMetricsComplete =
    hasExplicitProfileRepoMetrics || repositoryCollectionComplete;

  const topLanguages = normalizeLanguages(
    Array.isArray(explicitProfileRepoMetrics.topLanguages)
      ? explicitProfileRepoMetrics.topLanguages
      : derivedProfileRepoMetrics.topLanguages,
    asNumber(profileRepoMetrics.codeByteTotal, 0)
  );
  const totalContributions = asNumber(
    readmeSummary.totalContributions,
    asNumber(
      profileContributions.totalContributions,
      asNumber(legacy.totalContributions, 0)
    )
  );
  const starCount = asNumber(profileRepoMetrics.starsReceived, 0);
  const forkCount = asNumber(profileRepoMetrics.forksReceived, 0);
  const activeRepos = asNumber(profileRepoMetrics.activeOriginalRepos, 0);
  const totalRepos = asNumber(
    profileRepoMetrics.totalRepos,
    asNumber(profileRepoMetrics.publicRepos, 0)
  );
  const contributionCalendar = normalizeContributionCalendar(
    asRecord(profileContributions.contributionCalendar)
  );
  const timeline = normalizeTimeline(
    firstArray(
      presentation.timeline,
      asRecord(legacy.contributionStats).yearlyBreakdown
    )
  );
  const linesAdded = asNumber(
    contributorStats.linesAdded,
    asNumber(legacy.linesAdded, 0)
  );
  const linesDeleted = asNumber(
    contributorStats.linesDeleted,
    asNumber(legacy.linesDeleted, 0)
  );
  const linesOfCodeChanged = asNumber(
    contributorStats.linesOfCodeChanged,
    asNumber(legacy.linesOfCodeChanged, linesAdded + linesDeleted)
  );
  const linesChanged = asNumber(
    legacy.linesChanged,
    asNumber(contributorStats.linesOfCodeChanged, linesOfCodeChanged)
  );
  const backfillPending = asNumber(backfill.pending, 0);
  const isComplete = Boolean(
    readmeSummary.complete ??
    (collectionStatus.complete === true && backfillPending === 0)
  );

  return {
    schemaVersion: 2,
    name:
      asString(readmeSummary.name) ||
      asString(profile.name) ||
      asString(legacy.name) ||
      asString(profile.login) ||
      asString(legacy.username) ||
      'GitHub User',
    username:
      asString(readmeSummary.username) ||
      asString(profile.login) ||
      asString(legacy.username) ||
      'unknown',
    avatarUrl: asString(profile.avatarUrl) || asString(legacy.avatarUrl),
    bio: asNullableString(profile.bio ?? legacy.bio),
    websiteUrl: asNullableString(profile.websiteUrl ?? legacy.websiteUrl),
    location: asNullableString(profile.location ?? legacy.location),
    generatedAt,
    fetchedAt,
    isComplete,
    summary: {
      totalContributions,
      currentStreak: asNumber(
        readmeSummary.currentStreak,
        asNumber(contributionStats.currentStreak, 0)
      ),
      longestStreak: asNumber(
        readmeSummary.longestStreak,
        asNumber(contributionStats.longestStreak, 0)
      ),
      starsReceived: starCount,
      forksReceived: forkCount,
      activeRepos,
      totalRepos,
      languageCount: asNumber(
        profileRepoMetrics.languageCount,
        topLanguages.length
      ),
      profileMetricsComplete,
      refreshedAt: asString(readmeSummary.refreshedAt) || generatedAt
    },
    contributions: {
      totalContributions,
      totalCommits: asNumber(
        contributorStats.totalCommits,
        asNumber(
          legacy.totalCommits,
          asNumber(profileContributions.totalCommitContributions, 0)
        )
      ),
      restrictedContributionsCount: asNumber(
        profileContributions.restrictedContributionsCount,
        asNumber(
          asRecord(legacy.contributionsCollection).restrictedContributionsCount,
          0
        )
      ),
      currentStreak: asNumber(
        readmeSummary.currentStreak,
        asNumber(contributionStats.currentStreak, 0)
      ),
      longestStreak: asNumber(
        readmeSummary.longestStreak,
        asNumber(contributionStats.longestStreak, 0)
      ),
      peakDay: normalizePeakDay(contributionStats.peakDay),
      mostProductiveMonth: normalizeMostProductiveMonth(
        computedStats.mostProductiveMonth
      ),
      calendar: contributionCalendar,
      timeline
    },
    code: {
      codeByteTotal: asNumber(profileRepoMetrics.codeByteTotal, 0),
      linesAdded,
      linesDeleted,
      linesChanged,
      linesOfCodeChanged,
      contributorReposCompleted: asNumber(contributorStats.reposCompleted, 0),
      contributorReposPending: asNumber(contributorStats.reposPending, 0),
      contributorReposFailed: asNumber(contributorStats.reposFailed, 0)
    },
    community: {
      totalPullRequests: asNumber(
        activity.totalPullRequests,
        asNumber(legacy.totalPullRequests, 0)
      ),
      totalPullRequestReviews: asNumber(
        legacy.totalPullRequestReviews,
        asNumber(profileContributions.totalPullRequestReviewContributions, 0)
      ),
      openIssues: asNumber(activity.openIssues, asNumber(legacy.openIssues, 0)),
      closedIssues: asNumber(
        activity.closedIssues,
        asNumber(legacy.closedIssues, 0)
      ),
      repositoriesContributedTo: asNumber(
        activity.repositoriesContributedTo,
        asNumber(legacy.repositoriesContributedTo, 0)
      ),
      discussionsStarted: asNumber(
        activity.discussionsStarted,
        asNumber(legacy.discussionsStarted, 0)
      ),
      discussionsAnswered: asNumber(
        activity.discussionsAnswered,
        asNumber(legacy.discussionsAnswered, 0)
      ),
      starsGiven: asNumber(activity.starsGiven, asNumber(legacy.starsGiven, 0)),
      followers: asNumber(profile.followers, asNumber(legacy.followers, 0)),
      following: asNumber(profile.following, asNumber(legacy.following, 0))
    },
    repositories: {
      totalRepos,
      publicRepos: asNumber(profileRepoMetrics.publicRepos, totalRepos),
      privateRepos: asNumber(
        profileRepoMetrics.privateRepos,
        Math.max(0, totalRepos - asNumber(profileRepoMetrics.publicRepos, totalRepos))
      ),
      activeRepos,
      archivedRepos: asNumber(
        profileRepoMetrics.archivedOriginalRepos,
        asNumber(
          repoStats.archivedRepos,
          asNumber(computedStats.archivedRepos, 0)
        )
      ),
      forkedRepos: asNumber(
        profileRepoMetrics.forkedRepos,
        asNumber(repoStats.forkedRepos, asNumber(computedStats.forkedRepos, 0))
      ),
      originalRepos: asNumber(
        profileRepoMetrics.originalRepos,
        asNumber(
          readmeSummary.originalRepos,
          asNumber(
            repoStats.originalRepos,
            asNumber(computedStats.originalRepos, 0)
          )
        )
      ),
      reposWithStars: asNumber(
        profileRepoMetrics.reposWithStars,
        asNumber(
          repoStats.reposWithStars,
          asNumber(computedStats.reposWithStars, 0)
        )
      ),
      repoViews:
        asNumber(traffic.reposCompleted, 0) > 0
          ? asNumber(traffic.repoViews, null)
          : null,
      repoViewUniques:
        asNumber(traffic.reposCompleted, 0) > 0
          ? asNumber(traffic.repoViewUniques, null)
          : null,
      trafficReposCompleted: asNumber(traffic.reposCompleted, 0),
      trafficReposPending: asNumber(traffic.reposPending, 0),
      trafficReposFailed: asNumber(traffic.reposFailed, 0),
      starCount,
      forkCount
    },
    topLanguages,
    packages: normalizePackageMetrics(packageMetrics),
    cards: normalizeMetricCards(presentation.cards),
    highlights: normalizeMetricCards(presentation.highlights),
    privacy: {
      privateRepositoryMetricsIncluded:
        privacy.privateRepositoryMetricsIncluded === true,
      privateRepositoryDetailsIncluded:
        privacy.privateRepositoryDetailsIncluded === true,
      privateCacheDetailsIncluded: privacy.privateCacheDetailsIncluded === true,
      redactedPrivateRepositories: asNumber(
        privacy.redactedPrivateRepositories,
        0
      ),
      redactedRepositoryContributions: asNumber(
        privacy.redactedRepositoryContributions,
        0
      ),
      redactedOptionalMetrics: asNumber(privacy.redactedOptionalMetrics, 0)
    },
    collectionStatus: {
      complete: isComplete,
      coreComplete: collectionStatus.coreComplete !== false,
      backfillPending,
      backfillCompletedThisRun: asNumber(backfill.completedThisRun, 0),
      backfillFailedThisRun: asNumber(backfill.failedThisRun, 0),
      warnings: asStringArray(collectionStatus.warnings),
      errors: asStringArray(collectionStatus.errors)
    },
    repoViews:
      asNumber(traffic.reposCompleted, 0) > 0
        ? asNumber(traffic.repoViews, null)
        : null,
    linesOfCodeChanged,
    linesAdded,
    linesDeleted,
    linesChanged,
    totalCommits: asNumber(
      contributorStats.totalCommits,
      asNumber(legacy.totalCommits, 0)
    ),
    totalPullRequests: asNumber(
      activity.totalPullRequests,
      asNumber(legacy.totalPullRequests, 0)
    ),
    totalPullRequestReviews: asNumber(
      legacy.totalPullRequestReviews,
      asNumber(profileContributions.totalPullRequestReviewContributions, 0)
    ),
    openIssues: asNumber(activity.openIssues, asNumber(legacy.openIssues, 0)),
    closedIssues: asNumber(
      activity.closedIssues,
      asNumber(legacy.closedIssues, 0)
    ),
    forkCount,
    starCount,
    totalContributions,
    codeByteTotal: asNumber(
      repoMetrics.codeByteTotal,
      asNumber(legacy.codeByteTotal, 0)
    )
  };
}

function deriveProfileRepositoryMetrics(
  repositoriesValue: unknown,
  username: string,
  activeYear: string
): UnknownRecord {
  if (!Array.isArray(repositoriesValue)) {
    return {};
  }

  const ownedPublicRepos = asArray(repositoriesValue)
    .map(asRecord)
    .filter((repo) => {
      const sources = asStringArray(repo.sources);
      const owned =
        sources.includes('owned') || asString(repo.owner) === username;
      return owned && repo.isPrivate !== true;
    });
  const originalRepos = ownedPublicRepos.filter((repo) => repo.isFork !== true);
  const languageValues = originalRepos.flatMap((repo) =>
    asArray(repo.languages).map((language) => {
      const record = asRecord(language);
      return {
        languageName: asString(record.languageName) || asString(record.name),
        color: asNullableString(record.color),
        value: asNumber(record.value, asNumber(record.bytes, 0))
      };
    })
  );
  const codeByteTotal = languageValues.reduce(
    (sum, language) => sum + language.value,
    0
  );

  return {
    publicRepos: ownedPublicRepos.length,
    originalRepos: originalRepos.length,
    forkedRepos: ownedPublicRepos.length - originalRepos.length,
    activeOriginalRepos: originalRepos.filter((repo) =>
      (asString(repo.pushedAt) || asString(repo.updatedAt)).startsWith(
        activeYear
      )
    ).length,
    archivedOriginalRepos: originalRepos.filter(
      (repo) => repo.isArchived === true
    ).length,
    reposWithStars: originalRepos.filter((repo) => asNumber(repo.stars, 0) > 0)
      .length,
    starsReceived: originalRepos.reduce(
      (sum, repo) => sum + asNumber(repo.stars, 0),
      0
    ),
    forksReceived: originalRepos.reduce(
      (sum, repo) => sum + asNumber(repo.forks, 0),
      0
    ),
    codeByteTotal,
    languageCount: new Set(
      languageValues.map((language) => language.languageName)
    ).size,
    topLanguages: normalizeLanguages(languageValues, codeByteTotal)
  };
}

function isRepositoryCollectionComplete(
  repositoriesValue: unknown,
  repoStats: UnknownRecord,
  collectionStatus: UnknownRecord
): boolean {
  if (
    !Array.isArray(repositoriesValue) ||
    collectionStatus.coreComplete !== true
  ) {
    return false;
  }

  const expectedPublicRepos = asNumber(repoStats.publicRepos, -1);
  if (expectedPublicRepos < 0) {
    return false;
  }

  const collectedPublicRepos = asArray(repositoriesValue)
    .map(asRecord)
    .filter((repo) => repo.isPrivate !== true).length;

  return collectedPublicRepos >= expectedPublicRepos;
}

function normalizeLegacyStats(raw: UnknownRecord): UserStats {
  const contributionStats = asRecord(raw.contributionStats);
  const repoStats = asRecord(raw.repoStats);
  const computedStats = asRecord(raw.computedStats);
  const contributionsCollection = asRecord(raw.contributionsCollection);
  const totalContributions = asNumber(raw.totalContributions, 0);
  const codeByteTotal = asNumber(raw.codeByteTotal, 0);
  const topLanguages = normalizeLanguages(raw.topLanguages, codeByteTotal);
  const fetchedAt = asNumber(raw.fetchedAt, Date.now());
  const generatedAt = new Date(fetchedAt).toISOString();
  const linesAdded = asNumber(raw.linesAdded, 0);
  const linesDeleted = asNumber(raw.linesDeleted, 0);
  const linesOfCodeChanged = asNumber(
    raw.linesOfCodeChanged,
    linesAdded + linesDeleted
  );

  return {
    schemaVersion: null,
    name: asString(raw.name) || asString(raw.username) || 'GitHub User',
    username: asString(raw.username) || 'unknown',
    avatarUrl: asString(raw.avatarUrl),
    bio: asNullableString(raw.bio),
    websiteUrl: asNullableString(raw.websiteUrl),
    location: asNullableString(raw.location),
    generatedAt,
    fetchedAt,
    isComplete: true,
    summary: {
      totalContributions,
      currentStreak: asNumber(contributionStats.currentStreak, 0),
      longestStreak: asNumber(contributionStats.longestStreak, 0),
      starsReceived: asNumber(raw.starCount, 0),
      forksReceived: asNumber(raw.forkCount, 0),
      activeRepos: asNumber(repoStats.activeRepos, 0),
      totalRepos: asNumber(repoStats.totalRepos, asNumber(raw.totalRepos, 0)),
      languageCount: asNumber(computedStats.languageCount, topLanguages.length),
      profileMetricsComplete: false,
      refreshedAt: generatedAt
    },
    contributions: {
      totalContributions,
      totalCommits: asNumber(raw.totalCommits, asNumber(raw.commitCount, 0)),
      restrictedContributionsCount: asNumber(
        contributionsCollection.restrictedContributionsCount,
        0
      ),
      currentStreak: asNumber(contributionStats.currentStreak, 0),
      longestStreak: asNumber(contributionStats.longestStreak, 0),
      peakDay: normalizePeakDay(contributionStats.peakDay),
      mostProductiveMonth: normalizeMostProductiveMonth(
        computedStats.mostProductiveMonth
      ),
      calendar: normalizeContributionCalendar(
        asRecord(contributionsCollection.contributionCalendar)
      ),
      timeline: normalizeTimeline(contributionStats.yearlyBreakdown)
    },
    code: {
      codeByteTotal,
      linesAdded,
      linesDeleted,
      linesChanged: asNumber(raw.linesChanged, linesOfCodeChanged),
      linesOfCodeChanged,
      contributorReposCompleted: 0,
      contributorReposPending: 0,
      contributorReposFailed: 0
    },
    community: {
      totalPullRequests: asNumber(raw.totalPullRequests, 0),
      totalPullRequestReviews: asNumber(raw.totalPullRequestReviews, 0),
      openIssues: asNumber(raw.openIssues, 0),
      closedIssues: asNumber(raw.closedIssues, 0),
      repositoriesContributedTo: asNumber(raw.repositoriesContributedTo, 0),
      discussionsStarted: asNumber(raw.discussionsStarted, 0),
      discussionsAnswered: asNumber(raw.discussionsAnswered, 0),
      starsGiven: asNumber(raw.starsGiven, 0),
      followers: asNumber(raw.followers, 0),
      following: asNumber(raw.following, 0)
    },
    repositories: {
      totalRepos: asNumber(repoStats.totalRepos, asNumber(raw.totalRepos, 0)),
      publicRepos: asNumber(repoStats.publicRepos, 0),
      privateRepos: asNumber(repoStats.privateRepos, 0),
      activeRepos: asNumber(repoStats.activeRepos, 0),
      archivedRepos: asNumber(repoStats.archivedRepos, 0),
      forkedRepos: asNumber(repoStats.forkedRepos, 0),
      originalRepos: asNumber(repoStats.originalRepos, 0),
      reposWithStars: asNumber(repoStats.reposWithStars, 0),
      repoViews: asNumber(raw.repoViews, null),
      repoViewUniques: null,
      trafficReposCompleted: 0,
      trafficReposPending: 0,
      trafficReposFailed: 0,
      starCount: asNumber(raw.starCount, 0),
      forkCount: asNumber(raw.forkCount, 0)
    },
    topLanguages,
    packages: normalizePackageMetrics({}),
    cards: [],
    highlights: [],
    privacy: {
      privateRepositoryMetricsIncluded: false,
      privateRepositoryDetailsIncluded: false,
      privateCacheDetailsIncluded: false,
      redactedPrivateRepositories: 0,
      redactedRepositoryContributions: 0,
      redactedOptionalMetrics: 0
    },
    collectionStatus: {
      complete: true,
      coreComplete: true,
      backfillPending: 0,
      backfillCompletedThisRun: 0,
      backfillFailedThisRun: 0,
      warnings: [],
      errors: []
    },
    repoViews: asNumber(raw.repoViews, null),
    linesOfCodeChanged,
    linesAdded,
    linesDeleted,
    linesChanged: asNumber(raw.linesChanged, linesOfCodeChanged),
    totalCommits: asNumber(raw.totalCommits, asNumber(raw.commitCount, 0)),
    totalPullRequests: asNumber(raw.totalPullRequests, 0),
    totalPullRequestReviews: asNumber(raw.totalPullRequestReviews, 0),
    openIssues: asNumber(raw.openIssues, 0),
    closedIssues: asNumber(raw.closedIssues, 0),
    forkCount: asNumber(raw.forkCount, 0),
    starCount: asNumber(raw.starCount, 0),
    totalContributions,
    codeByteTotal
  };
}

export function normalizeLanguages(
  value: unknown,
  totalBytes: number
): RenderLanguage[] {
  const languages = asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const languageName =
        asString(record.languageName) || asString(record.name) || 'Unknown';
      const bytes = asNumber(record.value, asNumber(record.bytes, 0));
      const percentageValue = asNumber(
        record.percentage,
        totalBytes > 0 ? (bytes / totalBytes) * 100 : 0
      );

      return {
        languageName,
        color: asNullableString(record.color),
        value: bytes,
        percentage: percentageValue
      };
    })
    .filter((language) => language.value > 0);

  const byName = new Map<string, RenderLanguage>();
  for (const language of languages) {
    const current = byName.get(language.languageName);
    if (!current) {
      byName.set(language.languageName, language);
      continue;
    }
    current.value += language.value;
    current.percentage =
      totalBytes > 0 ? (current.value / totalBytes) * 100 : current.percentage;
  }

  return [...byName.values()].sort((a, b) => b.value - a.value);
}

function normalizeContributionCalendar(calendar: UnknownRecord) {
  return asArray(calendar.weeks).flatMap((week) =>
    asArray(asRecord(week).contributionDays).map((day) => {
      const record = asRecord(day);
      return {
        contributionCount: asNumber(record.contributionCount, 0),
        date: asString(record.date)
      };
    })
  );
}

function normalizeTimeline(value: unknown) {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      return {
        period: asString(record.period) || asString(record.year),
        contributions: asNumber(record.contributions, 0)
      };
    })
    .filter((item) => item.period)
    .sort((a, b) => a.period.localeCompare(b.period));
}

function normalizeMetricCards(value: unknown): MetricCard[] {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const id = asString(record.id);
      const label = asString(record.label);
      const rawValue = record.value;

      if (!id || !label || !isStringOrNumber(rawValue)) {
        return null;
      }

      const detail = asString(record.detail);
      const metric: MetricCard = {id, label, value: rawValue};
      if (detail) {
        metric.detail = detail;
      }

      return metric;
    })
    .filter((item): item is MetricCard => item !== null);
}

function normalizePackageMetrics(value: unknown): UserStats['packages'] {
  const metrics = asRecord(value);
  const downloads = asRecord(metrics.downloads);
  const packages = asArray(metrics.packages)
    .map(asRecord)
    .map((item) => {
      const itemDownloads = asRecord(item.downloads);
      return {
        provider: asString(item.provider),
        name: asString(item.name),
        url: asString(item.url),
        latestVersion: asNullableString(item.latestVersion),
        latestPublishedAt: asNullableString(item.latestPublishedAt),
        downloads: {
          lastDay: asNumber(itemDownloads.lastDay, 0),
          lastWeek: asNumber(itemDownloads.lastWeek, 0),
          lastMonth: asNumber(itemDownloads.lastMonth, 0),
          lastYear: asNumber(itemDownloads.lastYear, 0),
          allTime: asNumber(itemDownloads.allTime, 0)
        }
      };
    })
    .filter((item) => item.provider && item.name);

  return {
    packageCount: asNumber(metrics.packageCount, packages.length),
    providers: asStringArray(metrics.providers),
    downloads: {
      lastDay: asNumber(downloads.lastDay, 0),
      lastWeek: asNumber(downloads.lastWeek, 0),
      lastMonth: asNumber(downloads.lastMonth, 0),
      lastYear: asNumber(downloads.lastYear, 0),
      allTime: asNumber(downloads.allTime, 0)
    },
    packages,
    complete: metrics.complete !== false,
    warnings: asStringArray(metrics.warnings)
  };
}

function normalizePeakDay(value: unknown) {
  const record = asRecord(value);
  const date = asString(record.date);
  if (!date) {
    return null;
  }
  return {date, contributions: asNumber(record.contributions, 0)};
}

function normalizeMostProductiveMonth(value: unknown) {
  const record = asRecord(value);
  const month = asString(record.month);
  if (!month) {
    return null;
  }
  return {month, contributions: asNumber(record.contributions, 0)};
}

function assertPublicSafe(
  raw: UnknownRecord,
  allowPrivateRepositoryDetails: boolean
) {
  const privacy = asRecord(raw.privacy);
  const repositories = asArray(raw.repositories);
  const includesPrivateDetails =
    privacy.privateRepositoryDetailsIncluded === true ||
    repositories.some((repo) => asRecord(repo).isPrivate === true);

  if (includesPrivateDetails && !allowPrivateRepositoryDetails) {
    throw new Error(
      'Stats JSON includes private repository details. Refusing to render public profile assets.'
    );
  }
}

function firstArray(...values: unknown[]) {
  return values.find((value) => Array.isArray(value)) || [];
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber<T extends number | null>(
  value: unknown,
  fallback: T
): number | T {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter(
    (item): item is string => typeof item === 'string'
  );
}

function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}
