// @ts-check
import {defaultStats, normalizeLanguages, normalizeUserStats} from '@lukasparke/diffler-remotion';
import {emptyPackageMetrics} from '@lukasparke/diffler-schemas';

export const fixtureTime = '2026-05-29T00:00:00.000Z';

/** @typedef {import('@lukasparke/diffler-remotion').UserStats} UserStats */
/** @typedef {{id: string, description: string, userStats: UserStats}} VisualScenario */

/** Small synthetic profiles, not copied GitHub responses. Canonical nested values
 * are authoritative; the public normalizer synchronizes the legacy aliases. */
const normal = structuredClone(defaultStats);
normal.name = 'Ada Example';
normal.username = 'ada-example';
normal.avatarUrl = '';
normal.bio = null;
normal.websiteUrl = null;
normal.location = null;
normal.generatedAt = fixtureTime;
normal.fetchedAt = Date.parse(fixtureTime);
normal.summary.refreshedAt = fixtureTime;
normal.summary.profileMetricsComplete = true;
normal.isComplete = true;
normal.collectionStatus = {
  complete: true, coreComplete: true, backfillPending: 0,
  backfillCompletedThisRun: 216, backfillFailedThisRun: 0, warnings: [], errors: [],
};
normal.contributions.currentStreak = 11;
normal.contributions.longestStreak = 11;
normal.contributions.peakDay = {date: '2025-05-20', contributions: 610};
normal.contributions.calendar = [
  ...normal.contributions.timeline.slice(0, 4).map((point) => ({date: `${point.period}-05-20`, contributionCount: point.contributions})),
  ...Array.from({length: 11}, (_, index) => ({date: `2026-05-${19 + index}`, contributionCount: 41})),
];
normal.contributions.mostProductiveMonth = {month: '2025-05', contributions: 610};
normal.code = {
  ...normal.code, linesAdded: 456_789, linesDeleted: 123_456,
  linesOfCodeChanged: 580_245, contributorReposCompleted: 216,
  contributorReposPending: 0, contributorReposFailed: 0,
};
normal.repositories = {
  ...normal.repositories, activeRepos: 37, forkCount: 72, reposWithStars: 42,
  repoViews: 24_680, repoViewUniques: 3_210,
  trafficReposCompleted: 216, trafficReposPending: 0, trafficReposFailed: 0,
};
normal.community = {
  ...normal.community, openIssues: 18, closedIssues: 126,
  repositoriesContributedTo: 42, discussionsStarted: 8, discussionsAnswered: 15,
  starsGiven: 123, following: 24,
};
normal.topLanguages.push(
  {languageName: 'Rust', color: '#dea584', value: 19_000_000, percentage: 0},
  {languageName: 'CSS', color: '#563d7c', value: 7_000_000, percentage: 0},
  {languageName: 'Shell', color: '#89e051', value: 3_000_000, percentage: 0},
);
normal.summary.languageCount = normal.topLanguages.length;
normal.code.codeByteTotal = normal.topLanguages.reduce((sum, language) => sum + language.value, 0);
normal.topLanguages = normalizeLanguages(normal.topLanguages, normal.code.codeByteTotal);
normal.cards = [];
normal.highlights = [];
normal.packages = {
  packageCount: 3, providers: ['npm'], complete: true, warnings: [],
  downloads: {lastDay: 600, lastWeek: 4200, lastMonth: 18000, lastYear: 219000, allTime: 900000},
  packages: ['ada-tools', 'code-garden', 'graph-helpers'].map((name, index) => ({
    provider: 'npm', name, url: `https://www.npmjs.com/package/${name}`,
    latestVersion: '1.2.3', latestPublishedAt: fixtureTime,
    downloads: {lastDay: 100 * (3 - index), lastWeek: 700 * (3 - index), lastMonth: 3000 * (3 - index), lastYear: 36500 * (3 - index), allTime: 150000 * (3 - index)},
  })),
};

/** @type {UserStats} */
const empty = {
  ...structuredClone(normal), name: '', username: 'empty-profile',
  contributions: {
    totalContributions: 0, totalCommits: 0, restrictedContributionsCount: 0,
    currentStreak: 0, longestStreak: 0, peakDay: null, mostProductiveMonth: null,
    calendar: [], timeline: [],
  },
  code: {
    codeByteTotal: 0, linesAdded: 0, linesDeleted: 0, linesChanged: 0,
    linesOfCodeChanged: 0, contributorReposCompleted: 0,
    contributorReposPending: 0, contributorReposFailed: 0,
  },
  community: {
    totalPullRequests: 0, totalPullRequestReviews: 0, openIssues: 0, closedIssues: 0,
    repositoriesContributedTo: 0, discussionsStarted: 0, discussionsAnswered: 0,
    starsGiven: 0, followers: 0, following: 0,
  },
  repositories: {
    totalRepos: 0, publicRepos: 0, privateRepos: 0, activeRepos: 0, archivedRepos: 0,
    forkedRepos: 0, originalRepos: 0, reposWithStars: 0, repoViews: 0,
    repoViewUniques: 0, trafficReposCompleted: 0, trafficReposPending: 0,
    trafficReposFailed: 0, starCount: 0, forkCount: 0,
  },
  topLanguages: [],
  packages: emptyPackageMetrics(),
  summary: {...normal.summary, languageCount: 0},
  collectionStatus: {...normal.collectionStatus, backfillCompletedThisRun: 0},
};

const sparse = structuredClone(empty);
sparse.username = 'sparse-profile';
sparse.isComplete = false;
sparse.collectionStatus.complete = false;
sparse.collectionStatus.coreComplete = false;
sparse.contributions.totalContributions = 1;
sparse.contributions.totalCommits = 1;
sparse.contributions.currentStreak = 1;
sparse.contributions.longestStreak = 1;
sparse.contributions.timeline = [{period: '2026', contributions: 1}];
sparse.code.codeByteTotal = 1;
sparse.summary.languageCount = 1;
sparse.topLanguages = [{languageName: 'C', color: null, value: 1, percentage: 100}];
sparse.repositories.totalRepos = 1;
sparse.repositories.publicRepos = 1;
sparse.repositories.originalRepos = 1;

const long = structuredClone(normal);
long.name = 'Alexandria Maximiliana von Example — Developer of extraordinarily long-lived software';
long.username = 'a'.repeat(39);
long.packages.packages = long.packages.packages.map((item, index) => ({...item, name: '@example/' + 'extraordinarily-long-package-name-'.repeat(3) + index}));
long.topLanguages = normal.topLanguages.map((language, index) => ({
  ...language,
  languageName: [
    'Visual Basic .NET for Windows desktop applications',
    'VeryLongUnbrokenLanguageName'.repeat(3),
    'Common Lisp (portable multi-platform implementations)',
  ][index % 3] + ` ${index + 1}`,
}));

const large = structuredClone(normal);
large.name = 'Large Totals';
large.username = 'large-totals';
large.contributions.totalContributions = 9_876_543_210_123;
large.contributions.totalCommits = 1_234_567_890;
large.contributions.currentStreak = 12_345;
large.contributions.longestStreak = 98_765;
large.contributions.peakDay = {date: '2026-05-20', contributions: 123_456_789};
large.contributions.timeline = normal.contributions.timeline.map((point, index) => ({
  ...point, contributions: 123_456_789 * (index + 1),
}));
large.code = {
  ...large.code, codeByteTotal: 9_876_543_210_123,
  linesAdded: 987_654_321_012, linesDeleted: 123_456_789_012,
  linesOfCodeChanged: 1_111_111_110_024,
};
large.topLanguages = normalizeLanguages(normal.topLanguages.map((language) => ({
  ...language, value: language.value * 30_000,
})), large.code.codeByteTotal);
large.repositories = {
  ...large.repositories, totalRepos: 98_765, publicRepos: 98_765,
  originalRepos: 98_765, activeRepos: 12_345,
  starCount: 9_876_543_210, forkCount: 1_234_567_890, repoViews: 987_654_321_012,
};
large.community = {
  ...large.community, totalPullRequests: 123_456_789,
  totalPullRequestReviews: 12_345_678, openIssues: 1_234_567, closedIssues: 98_765_432,
  followers: 9_876_543_210, following: 12_345, discussionsStarted: 123_456,
  discussionsAnswered: 987_654, repositoriesContributedTo: 12_345,
};
large.summary.languageCount = 12_345;
large.packages.downloads.lastMonth = 987_654_321_012;
large.packages.downloads.lastYear = 1_234_567_890_123;
large.packages.downloads.allTime = 9_876_543_210_123;

const pending = structuredClone(normal);
pending.name = 'Optional Metrics Pending';
pending.username = 'pending-metrics';
pending.isComplete = false;
pending.code = {
  ...pending.code, linesAdded: 0, linesDeleted: 0, linesOfCodeChanged: 0,
  contributorReposCompleted: 0, contributorReposPending: 213, contributorReposFailed: 3,
};
pending.repositories = {
  ...pending.repositories, repoViews: 0, repoViewUniques: 0,
  trafficReposCompleted: 0, trafficReposPending: 213, trafficReposFailed: 3,
};
pending.collectionStatus = {
  ...pending.collectionStatus, complete: false, backfillPending: 213,
  backfillCompletedThisRun: 0, backfillFailedThisRun: 3,
  warnings: ['Synthetic fixture: optional metrics are not measured zeroes.'],
};
pending.packages.complete = false;
pending.packages.warnings = ['Synthetic fixture: one registry request failed.'];

/** @type {readonly VisualScenario[]} */
export const visualScenarios = [
  {id: 'normal', description: 'Complete profile, eight languages, local initials', userStats: normal},
  {id: 'empty', description: 'Zero totals, absent name/languages/history', userStats: empty},
  {id: 'sparse', description: 'One language/period, partial core and unknown optional coverage', userStats: sparse},
  {id: 'long', description: '39-character handle, long identity and language names', userStats: long},
  {id: 'large', description: 'Large integer/compact values and byte totals', userStats: large},
  {id: 'pending', description: 'Pending and failed optional metrics, complete core', userStats: pending},
].map((scenario) => ({...scenario, userStats: normalizeUserStats(scenario.userStats)}));
