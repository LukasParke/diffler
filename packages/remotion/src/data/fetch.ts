import {SourceProps, UserStats} from './schemas';
import {normalizeGithubStats, normalizeLanguages} from './adapter';

const defaultStatsTemplate = (username: string) =>
  `https://raw.githubusercontent.com/${username}/stats/main/github-user-stats.json`;

export async function fetchUserStats(
  inputProps: SourceProps,
): Promise<UserStats> {
  const allowPrivateRepositoryDetails =
    inputProps.allowPrivateRepositoryDetails === true;

  if (inputProps.stats) {
    return normalizeGithubStats(inputProps.stats, {
      allowPrivateRepositoryDetails,
    });
  }

  const urls = getStatsUrls(inputProps);
  const stats = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'github-readme-cards',
        },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch stats from ${url}: ${response.status}`,
        );
      }
      return normalizeGithubStats(await response.json(), {
        allowPrivateRepositoryDetails,
      });
    }),
  );

  return mergeUserStats(stats);
}

function getStatsUrls(inputProps: SourceProps): string[] {
  if (inputProps.statsUrl) {
    return [inputProps.statsUrl];
  }

  const usernames = inputProps.usernames?.length
    ? inputProps.usernames
    : [inputProps.username || 'stats-user'];

  return usernames.map((username) => defaultStatsTemplate(username));
}

function mergeUserStats(stats: UserStats[]): UserStats {
  if (stats.length === 0) {
    throw new Error('No GitHub stats were loaded');
  }

  const [first, ...rest] = stats;
  if (rest.length === 0) {
    return first;
  }

  for (const stat of rest) {
    first.summary.totalContributions += stat.summary.totalContributions;
    first.summary.starsReceived += stat.summary.starsReceived;
    first.summary.forksReceived += stat.summary.forksReceived;
    first.summary.activeRepos += stat.summary.activeRepos;
    first.summary.totalRepos += stat.summary.totalRepos;
    first.summary.profileMetricsComplete =
      first.summary.profileMetricsComplete &&
      stat.summary.profileMetricsComplete;
    first.contributions.totalContributions +=
      stat.contributions.totalContributions;
    first.contributions.totalCommits += stat.contributions.totalCommits;
    first.contributions.restrictedContributionsCount +=
      stat.contributions.restrictedContributionsCount;
    first.code.codeByteTotal += stat.code.codeByteTotal;
    first.code.linesAdded += stat.code.linesAdded;
    first.code.linesDeleted += stat.code.linesDeleted;
    first.code.linesChanged += stat.code.linesChanged;
    first.code.linesOfCodeChanged += stat.code.linesOfCodeChanged;
    first.community.totalPullRequests += stat.community.totalPullRequests;
    first.community.totalPullRequestReviews +=
      stat.community.totalPullRequestReviews;
    first.community.openIssues += stat.community.openIssues;
    first.community.closedIssues += stat.community.closedIssues;
    first.community.repositoriesContributedTo +=
      stat.community.repositoriesContributedTo;
    first.repositories.repoViews =
      first.repositories.repoViews === null ||
      stat.repositories.repoViews === null
        ? null
        : first.repositories.repoViews + stat.repositories.repoViews;
    first.repositories.repoViewUniques =
      first.repositories.repoViewUniques === null ||
      stat.repositories.repoViewUniques === null
        ? null
        : first.repositories.repoViewUniques +
          stat.repositories.repoViewUniques;
    first.repositories.starCount += stat.repositories.starCount;
    first.repositories.forkCount += stat.repositories.forkCount;
    first.topLanguages = normalizeLanguages(
      [...first.topLanguages, ...stat.topLanguages],
      first.code.codeByteTotal,
    );
    first.contributions.timeline = mergeTimeline(
      first.contributions.timeline,
      stat.contributions.timeline,
    );
  }

  first.repoViews = first.repositories.repoViews;
  first.linesOfCodeChanged = first.code.linesOfCodeChanged;
  first.linesAdded = first.code.linesAdded;
  first.linesDeleted = first.code.linesDeleted;
  first.linesChanged = first.code.linesChanged;
  first.totalCommits = first.contributions.totalCommits;
  first.totalPullRequests = first.community.totalPullRequests;
  first.totalPullRequestReviews = first.community.totalPullRequestReviews;
  first.openIssues = first.community.openIssues;
  first.closedIssues = first.community.closedIssues;
  first.forkCount = first.repositories.forkCount;
  first.starCount = first.repositories.starCount;
  first.totalContributions = first.contributions.totalContributions;
  first.codeByteTotal = first.code.codeByteTotal;

  return first;
}

function mergeTimeline(
  current: UserStats['contributions']['timeline'],
  next: UserStats['contributions']['timeline'],
): UserStats['contributions']['timeline'] {
  const byPeriod = new Map<string, number>();
  for (const item of [...current, ...next]) {
    byPeriod.set(
      item.period,
      (byPeriod.get(item.period) || 0) + item.contributions,
    );
  }
  return [...byPeriod.entries()]
    .map(([period, contributions]) => ({period, contributions}))
    .sort((a, b) => a.period.localeCompare(b.period));
}
