interface ContributionDay {
  date: string;
  contributionCount: number;
  color: string;
}

interface CalendarWeek {
  contributionDays: ContributionDay[];
}

function extractProfileSummary(results: Record<string, unknown>, username: string): Record<string, unknown> {
  const profile = (results.profile as Record<string, unknown>) ?? {};
  const contributions = (results.contributions as Record<string, unknown>) ?? {};
  const repos = (results.repositories as Record<string, unknown>[]) ?? [];
  return {
    username,
    name: profile.name || username,
    avatarUrl: profile.avatarUrl || `https://avatars.githubusercontent.com/u/${username}`,
    bio: profile.bio ?? null,
    company: profile.company ?? null,
    location: profile.location ?? null,
    followers: profile.followers ?? 0,
    following: profile.following ?? 0,
    contributions: contributions.totalContributions ?? 0,
    currentStreak: contributions.currentStreak ?? 0,
    repos: repos.length,
    stars: repos.reduce((a, r) => a + ((r.stars as number) ?? 0), 0),
  };
}

function parseTimestamp(iso: string): number {
  try {
    return new Date(iso).getTime();
  } catch {
    return 0;
  }
}

function aggregateContributions(contributionsList: Record<string, unknown>[]): Record<string, unknown> {
  if (contributionsList.length === 0) return {};

  let total = 0;
  let totalCommit = 0;
  let totalIssue = 0;
  let totalPR = 0;
  let totalReview = 0;
  let restricted = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  const calendarWeeks: CalendarWeek[] = [];

  for (const contrib of contributionsList) {
    total += (contrib.totalContributions as number) ?? 0;
    totalCommit += (contrib.totalCommitContributions as number) ?? 0;
    totalIssue += (contrib.totalIssueContributions as number) ?? 0;
    totalPR += (contrib.totalPullRequestContributions as number) ?? 0;
    totalReview += (contrib.totalPullRequestReviewContributions as number) ?? 0;
    restricted += (contrib.restrictedContributionsCount as number) ?? 0;
    currentStreak = Math.max(currentStreak, (contrib.currentStreak as number) ?? 0);
    longestStreak = Math.max(longestStreak, (contrib.longestStreak as number) ?? 0);
    const weeks = (contrib.calendar as CalendarWeek[]) ?? [];
    calendarWeeks.push(...weeks);
  }

  const mergedCalendar = mergeCalendars(calendarWeeks);

  return {
    totalContributions: total,
    totalCommitContributions: totalCommit,
    totalIssueContributions: totalIssue,
    totalPullRequestContributions: totalPR,
    totalPullRequestReviewContributions: totalReview,
    restrictedContributionsCount: restricted,
    currentStreak,
    longestStreak,
    calendar: mergedCalendar,
  };
}

const COLOR_SCALE = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

function upgradeColor(current: string, newColor: string): string {
  const currentIdx = COLOR_SCALE.indexOf(current);
  const newIdx = COLOR_SCALE.indexOf(newColor);
  if (newIdx > currentIdx) return newColor;
  return current;
}

function mergeCalendars(weeks: CalendarWeek[]): CalendarWeek[] {
  const dayCounts: Record<string, ContributionDay> = {};
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      const date = day.date;
      if (!date) continue;
      if (!dayCounts[date]) {
        dayCounts[date] = { date, contributionCount: day.contributionCount ?? 0, color: day.color ?? "#ebedf0" };
      } else {
        dayCounts[date].contributionCount += day.contributionCount ?? 0;
        dayCounts[date].color = upgradeColor(dayCounts[date].color, day.color ?? "#ebedf0");
      }
    }
  }

  const sortedDays = Object.values(dayCounts).sort((a, b) => a.date.localeCompare(b.date));
  const mergedWeeks: CalendarWeek[] = [];
  let currentWeek: ContributionDay[] = [];
  for (const day of sortedDays) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      mergedWeeks.push({ contributionDays: currentWeek });
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    mergedWeeks.push({ contributionDays: currentWeek });
  }

  return mergedWeeks;
}

function aggregateActivities(activities: Record<string, unknown>[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const activity of activities) {
    for (const [key, value] of Object.entries(activity)) {
      if (typeof value === "number") {
        result[key] = (result[key] ?? 0) + value;
      }
    }
  }
  return result;
}

function aggregateDiscussions(discussionsList: Record<string, unknown>[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const discussions of discussionsList) {
    for (const [key, value] of Object.entries(discussions)) {
      if (typeof value === "number") {
        result[key] = (result[key] ?? 0) + value;
      }
    }
  }
  return result;
}

export function aggregateResults(
  resultsByUser: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  if (Object.keys(resultsByUser).length === 0) return {};

  if (Object.keys(resultsByUser).length === 1) {
    const [username, results] = Object.entries(resultsByUser)[0];
    return { ...results, profiles: [extractProfileSummary(results, username)] };
  }

  const profiles: Record<string, unknown>[] = [];
  const allRepos: Record<string, unknown>[] = [];
  const allContributions: Record<string, unknown>[] = [];
  const allGists: Record<string, unknown>[] = [];
  const allTrafficViews: Record<string, unknown>[] = [];
  const allTrafficClones: Record<string, unknown>[] = [];
  const allContributorStats: Record<string, unknown>[] = [];
  const allActivity: Record<string, unknown>[] = [];
  const allDiscussions: Record<string, unknown>[] = [];
  const allStarsGiven: Record<string, unknown>[] = [];
  const allRepoContributions: Record<string, Record<string, number>> = {};
  let primaryProfile: Record<string, unknown> = {};

  for (const [username, results] of Object.entries(resultsByUser)) {
    profiles.push(extractProfileSummary(results, username));

    if (Object.keys(primaryProfile).length === 0 && results.profile) {
      primaryProfile = { ...(results.profile as Record<string, unknown>), username };
    }

    if (results.repositories) {
      allRepos.push(...(results.repositories as Record<string, unknown>[]));
    }
    if (results.contributions) {
      allContributions.push(results.contributions as Record<string, unknown>);
    }
    if (results.gists) {
      allGists.push(...(results.gists as Record<string, unknown>[]));
    }
    if (results.traffic) {
      const traffic = results.traffic as Record<string, unknown>;
      const views = traffic.views as Array<Record<string, unknown>> | undefined;
      const clones = traffic.clones as Array<Record<string, unknown>> | undefined;
      if (views) allTrafficViews.push(...views);
      if (clones) allTrafficClones.push(...clones);
    }
    if (results.contributor_stats) {
      allContributorStats.push(...(results.contributor_stats as Record<string, unknown>[]));
    }
    if (results.activity) {
      allActivity.push(results.activity as Record<string, unknown>);
    }
    if (results.discussions) {
      allDiscussions.push(results.discussions as Record<string, unknown>);
    }
    if (results.stars_given) {
      allStarsGiven.push(...(results.stars_given as Record<string, unknown>[]));
    }
    if (results.repo_contributions) {
      const repoContrib = results.repo_contributions as Record<string, Record<string, number>>;
      for (const [fullName, counts] of Object.entries(repoContrib)) {
        if (!allRepoContributions[fullName]) {
          allRepoContributions[fullName] = { ...counts };
        } else {
          for (const [key, value] of Object.entries(counts)) {
            allRepoContributions[fullName][key] = (allRepoContributions[fullName][key] ?? 0) + value;
          }
        }
      }
    }
  }

  // Deduplicate repos by full_name (keep most recent push)
  const seenRepos = new Map<string, Record<string, unknown>>();
  for (const repo of allRepos) {
    const fullName = repo.full_name as string;
    if (!fullName) continue;
    const existing = seenRepos.get(fullName);
    if (!existing || parseTimestamp(repo.pushed_at as string) > parseTimestamp(existing.pushed_at as string)) {
      seenRepos.set(fullName, repo);
    }
  }
  const dedupedRepos = Array.from(seenRepos.values());

  const aggregatedContributions = aggregateContributions(allContributions);
  const aggregatedActivity = aggregateActivities(allActivity);
  const aggregatedDiscussions = aggregateDiscussions(allDiscussions);

  return {
    profile: primaryProfile,
    profiles,
    contributions: aggregatedContributions,
    repositories: dedupedRepos,
    gists: allGists,
    traffic: { views: allTrafficViews, clones: allTrafficClones },
    contributor_stats: allContributorStats,
    activity: aggregatedActivity,
    discussions: aggregatedDiscussions,
    stars_given: allStarsGiven,
    repo_contributions: allRepoContributions,
  };
}
