interface LangBytes {
  languageName: string;
  color: string | null;
  value: number;
  percentage?: number;
}

interface RepoData {
  name?: string;
  full_name?: string;
  description?: string | null;
  url?: string;
  stars?: number;
  forks?: number;
  primary_language?: string | null;
  primary_language_color?: string | null;
  is_private?: boolean;
  is_fork?: boolean;
  is_archived?: boolean;
  topics?: string[];
  created_at?: string | null;
  pushed_at?: string | null;
  updated_at?: string | null;
  owner?: string | null;
  owner_type?: string | null;
  visibility?: string | null;
  languages?: Array<{ name: string; color: string | null; size: number }>;
}

function buildMetricCards(ctxResults: Record<string, unknown>): Array<Record<string, unknown>> {
  const profile = (ctxResults.profile as Record<string, unknown>) ?? {};
  const contributions = (ctxResults.contributions as Record<string, unknown>) ?? {};
  const repos = (ctxResults.repositories as RepoData[]) ?? [];
  const activity = (ctxResults.activity as Record<string, number>) ?? {};

  const cards: Array<Record<string, unknown>> = [
    { id: "contributions", label: "Contributions", value: contributions.totalContributions ?? 0 },
    { id: "commits", label: "Commits", value: contributions.totalCommitContributions ?? 0 },
    {
      id: "pull-requests",
      label: "Pull Requests",
      value: activity.totalPullRequests ?? contributions.totalPullRequestContributions ?? 0,
    },
    { id: "issues", label: "Issues", value: activity.closedIssues ?? 0 },
    { id: "repositories", label: "Repositories", value: repos.length },
    { id: "stars", label: "Stars", value: repos.reduce((a, r) => a + (r.stars ?? 0), 0) },
    { id: "followers", label: "Followers", value: profile.followers ?? 0 },
  ];

  const streak = (contributions.currentStreak as number) ?? 0;
  if (streak > 0) {
    cards.push({ id: "streak", label: "Current Streak", value: `${streak} days` });
  }

  return cards;
}

function buildHighlights(ctxResults: Record<string, unknown>): Array<Record<string, unknown>> {
  const contributions = (ctxResults.contributions as Record<string, unknown>) ?? {};
  const repos = (ctxResults.repositories as RepoData[]) ?? [];
  const activity = (ctxResults.activity as Record<string, number>) ?? {};
  const computed = (ctxResults.computed_stats as Record<string, unknown>) ?? {};

  const highlights: Array<Record<string, unknown>> = [];
  const totalStars = repos.reduce((a, r) => a + (r.stars ?? 0), 0);

  if ((contributions.currentStreak as number) >= 7) {
    highlights.push({
      id: "streak",
      label: "🔥 Streak",
      value: `${contributions.currentStreak} days`,
      detail: `Longest: ${contributions.longestStreak ?? 0} days`,
    });
  }

  if (totalStars >= 50) {
    highlights.push({
      id: "popular",
      label: "⭐ Popular",
      value: `${totalStars} stars`,
      detail: `Across ${repos.length} repos`,
    });
  }

  if ((activity.repositoriesContributedTo ?? 0) >= 5) {
    highlights.push({
      id: "contributor",
      label: "🌐 Contributor",
      value: `${activity.repositoriesContributedTo} repos`,
    });
  }

  const yoy = (computed.yearOverYearGrowth as number) ?? 0;
  if (yoy > 0) {
    highlights.push({
      id: "growth",
      label: "📈 Growth",
      value: `+${yoy}%`,
      detail: "Year over year",
    });
  }

  return highlights;
}

export function buildV2Output(ctxResults: Record<string, unknown>): Record<string, unknown> {
  const profile = (ctxResults.profile as Record<string, unknown>) ?? {};
  const contributions = (ctxResults.contributions as Record<string, unknown>) ?? {};
  const repos = (ctxResults.repositories as RepoData[]) ?? [];
  const gists = (ctxResults.gists as Array<Record<string, unknown>>) ?? [];
  const repoStats = (ctxResults.repo_stats as Record<string, unknown>) ?? {};
  const computedStats = (ctxResults.computed_stats as Record<string, unknown>) ?? {};
  const activity = (ctxResults.activity as Record<string, number>) ?? {};
  const traffic = (ctxResults.traffic as Record<string, Array<Record<string, unknown>>>) ?? {};
  const contributorStats = (ctxResults.contributor_stats as Array<Record<string, unknown>>) ?? [];
  const collectionStatus = (ctxResults._collection_status as Record<string, unknown>) ?? {};

  // Build top languages
  const langBytes: Record<string, LangBytes> = {};
  for (const repo of repos) {
    for (const lang of repo.languages ?? []) {
      const name = lang.name;
      if (!name) continue;
      if (!langBytes[name]) {
        langBytes[name] = { languageName: name, color: lang.color ?? null, value: 0 };
      }
      langBytes[name].value += lang.size;
    }
  }

  const totalBytes = Object.values(langBytes).reduce((a, l) => a + l.value, 0);
  const topLanguages = Object.values(langBytes)
    .sort((a, b) => b.value - a.value)
    .map((l) => ({
      ...l,
      percentage: totalBytes > 0 ? Math.round((l.value / totalBytes) * 10000) / 100 : 0,
    }));

  // Build top topics
  const topicCounts: Record<string, number> = {};
  for (const repo of repos) {
    for (const topic of repo.topics ?? []) {
      if (topic) {
        topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
      }
    }
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([topic, count]) => ({ topic, count }));

  const publicRepos = repos.filter((r) => !r.is_private);
  const totalStars = repos.reduce((a, r) => a + (r.stars ?? 0), 0);
  const totalForks = repos.reduce((a, r) => a + (r.forks ?? 0), 0);

  const totalViews = (traffic.views ?? []).reduce((a, v) => a + ((v.count as number) ?? 0), 0);
  const totalAdditions = contributorStats.reduce((a, c) => a + ((c.additions as number) ?? 0), 0);
  const totalDeletions = contributorStats.reduce((a, c) => a + ((c.deletions as number) ?? 0), 0);

  const cards = buildMetricCards(ctxResults);
  const highlights = buildHighlights(ctxResults);

  return {
    schemaVersion: 2,
    name: profile.name,
    username: profile.login,
    avatarUrl: `https://avatars.githubusercontent.com/u/${profile.login ?? ""}`,
    bio: profile.bio,
    company: profile.company,
    location: profile.location,
    email: profile.email,
    twitterUsername: profile.twitterUsername,
    websiteUrl: profile.websiteUrl,
    createdAt: profile.createdAt,
    followers: profile.followers ?? 0,
    following: profile.following ?? 0,
    starredRepositories: profile.starredRepositories ?? 0,
    publicGists: gists.length,
    totalCommits: contributions.totalCommitContributions ?? 0,
    totalPullRequests: contributions.totalPullRequestContributions ?? 0,
    totalPullRequestReviews: contributions.totalPullRequestReviewContributions ?? 0,
    commitCount: contributions.totalCommitContributions ?? 0,
    linesOfCodeChanged: totalAdditions + totalDeletions,
    linesAdded: totalAdditions,
    linesDeleted: totalDeletions,
    linesChanged: totalAdditions + totalDeletions,
    repoViews: totalViews,
    repoViewUniques: (traffic.views ?? []).reduce((a, v) => a + ((v.uniques as number) ?? 0), 0),
    codeByteTotal: totalBytes,
    topLanguages,
    topTopics,
    starsGiven: activity.starsGiven ?? 0,
    openIssues: activity.openIssues ?? 0,
    closedIssues: activity.closedIssues ?? 0,
    repositoriesContributedTo: activity.repositoriesContributedTo ?? 0,
    discussionsStarted: activity.discussionsStarted ?? 0,
    discussionsAnswered: activity.discussionsAnswered ?? 0,
    profileContributions: {
      totalContributions: contributions.totalContributions ?? 0,
      totalCommitContributions: contributions.totalCommitContributions ?? 0,
      totalIssueContributions: contributions.totalIssueContributions ?? 0,
      totalPullRequestContributions: contributions.totalPullRequestContributions ?? 0,
      totalPullRequestReviewContributions: contributions.totalPullRequestReviewContributions ?? 0,
      totalRepositoryContributions: repos.length,
      restrictedContributionsCount: contributions.restrictedContributionsCount ?? 0,
      contributionCalendar: {
        totalContributions: contributions.totalContributions ?? 0,
        weeks: contributions.calendar ?? [],
      },
      stats: {
        currentStreak: contributions.currentStreak ?? 0,
        longestStreak: contributions.longestStreak ?? 0,
        longestStreakStartDate: contributions.longestStreakStartDate ?? "",
        longestStreakEndDate: contributions.longestStreakEndDate ?? "",
      },
    },
    activity,
    repositories: repos.map((r) => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      url: r.url,
      stars: r.stars ?? 0,
      forks: r.forks ?? 0,
      language: r.primary_language,
      language_color: r.primary_language_color,
      isPrivate: r.is_private ?? false,
      isFork: r.is_fork ?? false,
      isArchived: r.is_archived ?? false,
      topics: r.topics ?? [],
      createdAt: r.created_at,
      pushedAt: r.pushed_at,
      updatedAt: r.updated_at,
      owner: r.owner,
      ownerType: r.owner_type,
      visibility: r.visibility,
    })),
    repoMetrics: {
      starCount: totalStars,
      forkCount: totalForks,
      codeByteTotal: totalBytes,
      topLanguages,
      topTopics,
      publicRepoCount: publicRepos.length,
      contributorStats: contributorStats,
      traffic,
      repoStats,
      computedStats,
    },
    repoStats,
    computedStats,
    cards,
    highlights,
    presentation: {
      readmeSummary: {
        contributions: contributions.totalContributions ?? 0,
        streak: contributions.currentStreak ?? 0,
        repos: repos.length,
        stars: totalStars,
      },
      remotion: {
        username: profile.login,
        totalContributions: contributions.totalContributions ?? 0,
        currentStreak: contributions.currentStreak ?? 0,
        longestStreak: contributions.longestStreak ?? 0,
        topLanguages: topLanguages.slice(0, 6).map((l) => ({
          name: l.languageName,
          percentage: l.percentage,
        })),
      },
    },
    privacy: {
      includePrivateDetails: true,
      redactedEntries: 0,
    },
    collectionStatus: {
      complete: collectionStatus.complete ?? true,
      coreComplete: collectionStatus.coreComplete ?? true,
      backfillPending: collectionStatus.backfillPending ?? 0,
      backfillCompletedThisRun: collectionStatus.backfillCompletedThisRun ?? 0,
      backfillFailedThisRun: collectionStatus.backfillFailedThisRun ?? 0,
      warnings: collectionStatus.warnings ?? [],
      errors: collectionStatus.errors ?? [],
      timestamp: collectionStatus.timestamp ?? "",
    },
  };
}
