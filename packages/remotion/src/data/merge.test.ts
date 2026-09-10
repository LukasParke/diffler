import {expect, it} from 'vitest';
import {
	createFullV2,
	fetchedAt,
	generatedAt,
} from '../../../schemas/tests/fixtures';
import {mergeUserStats, normalizeGithubStats, type UserStats} from './index';

function profile(username: string): UserStats {
	return {...normalizeGithubStats(createFullV2()), username, name: username};
}

function withCalendar(
	stats: UserStats,
	calendar: UserStats['contributions']['calendar'],
): UserStats {
	const totalContributions = calendar.reduce(
		(sum, day) => sum + day.contributionCount,
		0,
	);
	return {
		...stats,
		contributions: {
			...stats.contributions,
			calendar,
			totalContributions,
			timeline: [{period: '2024', contributions: totalContributions}],
		},
	};
}

it('merges overlapping and disjoint languages using the combined byte denominator', () => {
	const first = profile('octocat');
	const second = profile('hubot');
	const merged = mergeUserStats([
		{
			...first,
			summary: {...first.summary, languageCount: 2},
			topLanguages: [
				{languageName: 'TypeScript', color: null, value: 50, percentage: 50},
				{languageName: 'Go', color: null, value: 50, percentage: 50},
			],
		},
		{
			...second,
			summary: {...second.summary, languageCount: 2},
			topLanguages: [
				{languageName: 'TypeScript', color: null, value: 30, percentage: 30},
				{languageName: 'Rust', color: null, value: 70, percentage: 70},
			],
		},
	]);
	expect(merged.topLanguages).toEqual([
		{languageName: 'TypeScript', color: null, value: 80, percentage: 40},
		{languageName: 'Rust', color: null, value: 70, percentage: 35},
		{languageName: 'Go', color: null, value: 50, percentage: 25},
	]);
	expect(merged.summary.languageCount).toBe(3);
});

it('recalculates percentages after all three profiles have contributed bytes', () => {
	const first = profile('octocat');
	const second = profile('hubot');
	const third = profile('robot');
	const merged = mergeUserStats([
		{
			...first,
			summary: {...first.summary, languageCount: 1},
			topLanguages: [
				{languageName: 'Go', color: null, value: 100, percentage: 100},
			],
		},
		{
			...second,
			summary: {...second.summary, languageCount: 1},
			topLanguages: [
				{languageName: 'Rust', color: null, value: 100, percentage: 100},
			],
		},
		{
			...third,
			summary: {...third.summary, languageCount: 1},
			topLanguages: [
				{languageName: 'TypeScript', color: null, value: 100, percentage: 100},
			],
		},
	]);
	expect(merged.topLanguages[0].percentage).toBeCloseTo(100 / 3);
	expect(merged.topLanguages[1].percentage).toBeCloseTo(100 / 3);
	expect(merged.topLanguages[2].percentage).toBeCloseTo(100 / 3);
	expect(merged.summary.languageCount).toBe(3);
});

it('sums repository, community and optional coverage counts instead of leaving first-source values', () => {
	const first = profile('octocat');
	const second = profile('hubot');
	const merged = mergeUserStats([
		first,
		{
			...second,
			repositories: {
				totalRepos: 3,
				publicRepos: 2,
				privateRepos: 1,
				activeRepos: 2,
				archivedRepos: 1,
				forkedRepos: 1,
				originalRepos: 2,
				reposWithStars: 2,
				repoViews: 7,
				repoViewUniques: 4,
				trafficReposCompleted: 2,
				trafficReposPending: 1,
				trafficReposFailed: 1,
				starCount: 9,
				forkCount: 3,
			},
			community: {
				totalPullRequests: 4,
				totalPullRequestReviews: 2,
				openIssues: 3,
				closedIssues: 4,
				repositoriesContributedTo: 2,
				discussionsStarted: 3,
				discussionsAnswered: 2,
				starsGiven: 5,
				followers: 6,
				following: 7,
			},
			code: {
				...second.code,
				linesAdded: 10,
				linesDeleted: 4,
				linesChanged: 14,
				linesOfCodeChanged: 14,
				contributorReposCompleted: 2,
				contributorReposPending: 1,
				contributorReposFailed: 1,
			},
		},
	]);
	expect(merged.repositories).toEqual({
		totalRepos: 4,
		publicRepos: 3,
		privateRepos: 1,
		activeRepos: 3,
		archivedRepos: 1,
		forkedRepos: 1,
		originalRepos: 3,
		reposWithStars: 3,
		repoViews: 12,
		repoViewUniques: 7,
		trafficReposCompleted: 3,
		trafficReposPending: 1,
		trafficReposFailed: 1,
		starCount: 16,
		forkCount: 5,
	});
	expect(merged.community).toEqual({
		totalPullRequests: 7,
		totalPullRequestReviews: 3,
		openIssues: 4,
		closedIssues: 6,
		repositoriesContributedTo: 3,
		discussionsStarted: 5,
		discussionsAnswered: 3,
		starsGiven: 9,
		followers: 8,
		following: 10,
	});
	expect(merged.code).toEqual({
		codeByteTotal: 200,
		linesAdded: 18,
		linesDeleted: 6,
		linesChanged: 24,
		linesOfCodeChanged: 24,
		contributorReposCompleted: 3,
		contributorReposPending: 1,
		contributorReposFailed: 1,
	});
	expect(merged.summary).toMatchObject({
		totalRepos: 4,
		activeRepos: 3,
		starsReceived: 16,
		forksReceived: 5,
	});
});

it('keeps every top-level metric alias in sync after merging', () => {
	const merged = mergeUserStats([profile('octocat'), profile('hubot')]);
	expect(merged).toMatchObject({
		repoViews: 10,
		linesOfCodeChanged: 20,
		linesAdded: 16,
		linesDeleted: 4,
		linesChanged: 20,
		totalCommits: 18,
		totalPullRequests: 6,
		totalPullRequestReviews: 2,
		openIssues: 2,
		closedIssues: 4,
		forkCount: 4,
		starCount: 14,
		totalContributions: 24,
		codeByteTotal: 200,
	});
});

it('sums shared calendar dates and recomputes combined streaks, peaks, months and timeline', () => {
	const first = withCalendar(profile('octocat'), [
		{date: '2024-01-01', contributionCount: 2},
		{date: '2024-01-03', contributionCount: 1},
	]);
	const second = withCalendar(profile('hubot'), [
		{date: '2024-01-02', contributionCount: 3},
		{date: '2024-01-03', contributionCount: 4},
		{date: '2024-01-04', contributionCount: 0},
	]);
	const merged = mergeUserStats([first, second]);
	expect(merged.contributions).toMatchObject({
		totalContributions: 10,
		longestStreak: 3,
		currentStreak: 3,
		peakDay: {date: '2024-01-03', contributions: 5},
		mostProductiveMonth: {month: '2024-01', contributions: 10},
		timeline: [{period: '2024', contributions: 10}],
		calendar: [
			{date: '2024-01-01', contributionCount: 2},
			{date: '2024-01-02', contributionCount: 3},
			{date: '2024-01-03', contributionCount: 5},
			{date: '2024-01-04', contributionCount: 0},
		],
	});
	expect(merged.summary).toMatchObject({
		currentStreak: 3,
		longestStreak: 3,
		totalContributions: 10,
	});
});

it('breaks streaks across absent calendar dates rather than counting array entries', () => {
	const merged = mergeUserStats([
		withCalendar(profile('octocat'), [
			{date: '2024-01-01', contributionCount: 1},
		]),
		withCalendar(profile('hubot'), [
			{date: '2024-01-03', contributionCount: 1},
		]),
	]);
	expect(merged.contributions).toMatchObject({
		longestStreak: 1,
		currentStreak: 1,
	});
});

it('ends a current streak when the most recent active day is older than yesterday', () => {
	const merged = mergeUserStats([
		withCalendar(profile('octocat'), [
			{date: '2024-01-01', contributionCount: 1},
		]),
		withCalendar(profile('hubot'), [
			{date: '2024-01-02', contributionCount: 1},
		]),
	]);
	expect(merged.contributions).toMatchObject({
		longestStreak: 2,
		currentStreak: 0,
	});
});

it('counts a contribution on the generation date in the current streak', () => {
	const merged = mergeUserStats([
		withCalendar(profile('octocat'), [
			{date: '2024-01-03', contributionCount: 1},
		]),
		withCalendar(profile('hubot'), [
			{date: '2024-01-04', contributionCount: 1},
		]),
	]);
	expect(merged.contributions.currentStreak).toBe(2);
});

it('flags missing calendars instead of merging ungrounded streak summaries', () => {
	const first = profile('octocat');
	const merged = mergeUserStats([
		{
			...first,
			contributions: {
				...first.contributions,
				calendar: [],
				currentStreak: 99,
				longestStreak: 99,
			},
		},
		profile('hubot'),
	]);
	expect(merged.contributions).toMatchObject({
		totalContributions: 24,
		longestStreak: 2,
		currentStreak: 2,
	});
	expect(merged.collectionStatus).toMatchObject({
		complete: false,
		coreComplete: false,
	});
	expect(merged.collectionStatus.warnings).toContain(
		'Merged streaks and peak dates cover only supplied calendars; contribution days are missing.',
	);
});

it('reports only known unique language names when an input list is truncated', () => {
	const first = profile('octocat');
	const merged = mergeUserStats([
		{
			...first,
			topLanguages: first.topLanguages.slice(0, 2),
			summary: {...first.summary, languageCount: 10},
		},
		profile('hubot'),
	]);
	expect(merged.summary.languageCount).toBe(6);
	expect(merged.isComplete).toBe(false);
	expect(merged.collectionStatus.warnings).toContain(
		'Merged language count covers only supplied names; omitted languages cannot be deduplicated.',
	);
});

it('combines completeness, errors, warnings and backfill counts from every source', () => {
	const first = profile('octocat');
	const second = profile('hubot');
	const merged = mergeUserStats([
		first,
		{
			...second,
			isComplete: false,
			collectionStatus: {
				complete: false,
				coreComplete: false,
				backfillPending: 3,
				backfillCompletedThisRun: 1,
				backfillFailedThisRun: 2,
				warnings: ['missing year'],
				errors: ['request failed'],
			},
		},
	]);
	expect(merged.isComplete).toBe(false);
	expect(merged.collectionStatus).toMatchObject({
		complete: false,
		coreComplete: false,
		backfillPending: 3,
		backfillCompletedThisRun: 3,
		backfillFailedThisRun: 2,
		errors: ['request failed'],
	});
	expect(merged.collectionStatus.warnings).toContain('missing year');
});

it('retains completeness when all supplied data and metric coverage are complete', () => {
	const merged = mergeUserStats([profile('octocat'), profile('hubot')]);
	expect(merged.isComplete).toBe(true);
	expect(merged.collectionStatus).toMatchObject({
		complete: true,
		coreComplete: true,
	});
});

it('combines privacy flags and redaction counts instead of inheriting only the first report', () => {
	const second = profile('hubot');
	const merged = mergeUserStats([
		profile('octocat'),
		{
			...second,
			privacy: {
				privateRepositoryMetricsIncluded: true,
				privateRepositoryDetailsIncluded: true,
				privateCacheDetailsIncluded: true,
				redactedPrivateRepositories: 2,
				redactedRepositoryContributions: 3,
				redactedOptionalMetrics: 4,
			},
		},
	]);
	expect(merged.privacy).toEqual({
		privateRepositoryMetricsIncluded: true,
		privateRepositoryDetailsIncluded: true,
		privateCacheDetailsIncluded: true,
		redactedPrivateRepositories: 2,
		redactedRepositoryContributions: 3,
		redactedOptionalMetrics: 4,
	});
});

it('uses honest additive metadata semantics and drops stale per-profile presentation metrics', () => {
	const merged = mergeUserStats([profile('octocat'), profile('hubot')]);
	expect(merged.repositories.totalRepos).toBe(2);
	expect(merged.collectionStatus.warnings).toContain(
		'Merged profile totals are additive, not repository/person/visitor-deduplicated.',
	);
	expect(merged.cards).toEqual([]);
	expect(merged.highlights).toEqual([]);
});

it('retains first-source identity while reporting newest generation and oldest refresh times', () => {
	const second = profile('hubot');
	const merged = mergeUserStats([
		profile('octocat'),
		{
			...second,
			generatedAt: '2024-01-06T12:00:00.000Z',
			fetchedAt: fetchedAt + 172800000,
			summary: {...second.summary, refreshedAt: '2024-01-06T12:00:00.000Z'},
		},
	]);
	expect(merged).toMatchObject({
		username: 'octocat',
		generatedAt: '2024-01-06T12:00:00.000Z',
		fetchedAt: fetchedAt + 172800000,
	});
	expect(merged.summary.refreshedAt).toBe(generatedAt);
	expect(merged.contributions.currentStreak).toBe(0);
});

it('does not mutate or retain mutable nested references to the first result', () => {
	const first = profile('octocat');
	const second = profile('hubot');
	const before = structuredClone([first, second]);
	const merged = mergeUserStats([first, second]);
	expect([first, second]).toEqual(before);
	expect(merged).not.toBe(first);
	expect(merged.contributions).not.toBe(first.contributions);
	expect(merged.topLanguages[0]).not.toBe(first.topLanguages[0]);
});

it('returns an independent validated result even for a single profile', () => {
	const first = profile('octocat');
	const merged = mergeUserStats([first]);
	expect(merged).toEqual(first);
	expect(merged.code).not.toBe(first.code);
});

it('does not label a mixed v2/legacy merge as wholly v2 or complete', () => {
	const legacy = normalizeGithubStats({
		...createFullV2().legacy,
		username: 'hubot',
	});
	const merged = mergeUserStats([profile('octocat'), legacy]);
	expect(merged).toMatchObject({
		schemaVersion: null,
		isComplete: false,
		totalCommits: 18,
	});
});

it('rejects duplicate profile snapshots instead of double-counting them', () => {
	expect(() =>
		mergeUserStats([profile('octocat'), profile('OctoCat')]),
	).toThrow('same GitHub profile');
});

it('rejects an empty merge', () => {
	expect(() => mergeUserStats([])).toThrow('No GitHub stats were loaded');
});
