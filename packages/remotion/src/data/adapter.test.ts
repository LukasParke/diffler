import {expect, expectTypeOf, it} from 'vitest';
import {calculateProfileRepoMetrics} from '@lukasparke/diffler-schemas';
import {
	createFullV2,
	createMinimalV2,
	fetchedAt,
	generatedAt,
} from '../../../schemas/tests/fixtures';
import {
	normalizeGithubStats,
	normalizeLanguages,
	normalizeUserStats,
	userStatsSchema,
	type UserStats,
} from './index';

it('preserves the public UserStats schemaVersion field type while validating known versions', () => {
	expectTypeOf<UserStats['schemaVersion']>().toEqualTypeOf<number | null>();
});

it('normalizes minimal canonical v2 while marking absent metric coverage incomplete', () => {
	const stats = normalizeGithubStats(createMinimalV2());
	expect(stats).toMatchObject({
		username: 'octocat',
		generatedAt,
		fetchedAt,
		isComplete: false,
		contributions: {
			totalContributions: 12,
			totalCommits: 9,
			currentStreak: 2,
			longestStreak: 2,
		},
		code: {contributorReposCompleted: 0, contributorReposPending: 0},
		collectionStatus: {complete: false, coreComplete: false},
	});
	expect(stats.collectionStatus.warnings).toContain(
		'Contributor metrics are missing; line-change coverage is unknown.',
	);
	expect(userStatsSchema.safeParse(stats).success).toBe(true);
});

it('normalizes complete v2 with the public aliases intact', () => {
	const stats = normalizeGithubStats(createFullV2());
	expect(stats).toMatchObject({
		isComplete: true,
		totalContributions: 12,
		totalCommits: 9,
		totalPullRequests: 3,
		totalPullRequestReviews: 1,
		repoViews: 5,
		linesAdded: 8,
		linesDeleted: 2,
		linesChanged: 10,
		linesOfCodeChanged: 10,
		starCount: 7,
		forkCount: 2,
		codeByteTotal: 100,
		summary: {totalRepos: 1, languageCount: 6},
		collectionStatus: {complete: true, coreComplete: true},
	});
});

it('derives owned-original scope for historical v2 records without inflating it with forks or contributed repositories', () => {
	const raw = createFullV2();
	const repository = raw.repositories[0];
	raw.repositories.push(
		{...repository, id: 'R_FORK', isFork: true, stars: 9000, codeByteTotal: 9000},
		{...repository, id: 'R_EXTERNAL', owner: 'another-user', sources: ['contributed'], stars: 8000},
	);
	raw.repoMetrics.starCount = 17007;
	const stats = normalizeGithubStats(raw);
	expect(stats.repositories).toMatchObject({totalRepos: 2, publicRepos: 2, originalRepos: 1, forkedRepos: 1, starCount: 7});
	expect(stats.code.codeByteTotal).toBe(100);
	expect(stats.summary.profileMetricsComplete).toBe(true);
});

it('preserves explicitly anonymous private metrics without requiring private-detail rendering permission', () => {
	const raw = createFullV2();
	raw.privacy.privateRepositoryMetricsIncluded = true;
	raw.privacy.redactedPrivateRepositories = 2;
	raw.repoMetrics.profile = {
		...calculateProfileRepoMetrics(raw.repositories, fetchedAt),
		totalRepos: 3, privateRepos: 2, originalRepos: 3, starsReceived: 57,
	};
	const stats = normalizeGithubStats(raw);
	expect(stats.repositories).toMatchObject({totalRepos: 3, privateRepos: 2, starCount: 57});
	expect(stats.privacy).toMatchObject({privateRepositoryMetricsIncluded: true, privateRepositoryDetailsIncluded: false});
});

it('uses profile commits instead of optional repository-backfill zeroes', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		repoMetrics: {
			...raw.repoMetrics,
			contributorStats: {
				...raw.repoMetrics.contributorStats,
				totalCommits: 0,
				reposCompleted: 0,
				reposPending: 1,
			},
		},
	});
	expect(stats.totalCommits).toBe(9);
	expect(stats.contributions.totalCommits).toBe(9);
});

it('uses profile commits even when repository backfill has a larger count', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		repoMetrics: {
			...raw.repoMetrics,
			contributorStats: {...raw.repoMetrics.contributorStats, totalCommits: 99},
		},
	});
	expect(stats.totalCommits).toBe(9);
});

it('uses the complete repository language list, not the presentation top five', () => {
	const stats = normalizeGithubStats(createFullV2());
	expect(stats.topLanguages.map((language) => language.languageName)).toEqual([
		'TypeScript',
		'JavaScript',
		'C',
		'Go',
		'Python',
		'Rust',
	]);
	expect(stats.summary.languageCount).toBe(6);
});

it('does not mark a truncated canonical language list complete', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		repoMetrics: {
			...raw.repoMetrics,
			profile: {
				...calculateProfileRepoMetrics(raw.repositories, fetchedAt),
				topLanguages: raw.repoMetrics.topLanguages.slice(0, 5),
			},
		},
	});
	expect(stats.isComplete).toBe(false);
	expect(stats.collectionStatus.coreComplete).toBe(false);
	expect(stats.collectionStatus.warnings).toContain(
		'Language data does not cover the reported totals.',
	);
});

it('uses canonical profile streaks and dates without legacy or presentation aliases', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		legacy: undefined,
		presentation: undefined,
	});
	expect(stats.contributions).toMatchObject({
		currentStreak: 2,
		longestStreak: 2,
		peakDay: {date: '2024-01-03', contributions: 5},
		mostProductiveMonth: {month: '2024-01', contributions: 12},
		timeline: [{period: '2024', contributions: 12}],
	});
});

it('ignores stale presentation and legacy aliases when canonical data is present', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		legacy: {
			...raw.legacy,
			totalCommits: 0,
			fetchedAt: 0,
			contributionStats: {...raw.legacy.contributionStats, peakDay: null},
		},
		presentation: {
			...raw.presentation,
			readmeSummary: {
				...raw.presentation.readmeSummary,
				name: 'Stale Name',
				currentStreak: 0,
				longestStreak: 0,
				totalContributions: 0,
				starsReceived: 0,
				forksReceived: 0,
				activeRepos: 0,
			},
		},
	});
	expect(stats).toMatchObject({
		name: 'Octo Cat',
		fetchedAt,
		totalContributions: 12,
		totalCommits: 9,
		starCount: 7,
		forkCount: 2,
		summary: {currentStreak: 2, longestStreak: 2, activeRepos: 1},
		contributions: {peakDay: {date: '2024-01-03', contributions: 5}},
	});
});

it('retains pending and failed optional-metric counts despite optimistic summaries', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		repoMetrics: {
			...raw.repoMetrics,
			contributorStats: {
				...raw.repoMetrics.contributorStats,
				reposCompleted: 0,
				reposPending: 1,
			},
			traffic: {...raw.repoMetrics.traffic, reposCompleted: 0, reposFailed: 1},
		},
	});
	expect(stats).toMatchObject({
		isComplete: false,
		code: {
			contributorReposCompleted: 0,
			contributorReposPending: 1,
			contributorReposFailed: 0,
		},
		repositories: {
			trafficReposCompleted: 0,
			trafficReposPending: 0,
			trafficReposFailed: 1,
		},
		collectionStatus: {complete: false, coreComplete: true},
	});
});

it('marks absent optional metrics unknown without inventing pending repository counts', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		repoMetrics: {
			...raw.repoMetrics,
			contributorStats: undefined,
			traffic: undefined,
		},
	});
	expect(stats.isComplete).toBe(false);
	expect(stats.collectionStatus.coreComplete).toBe(true);
	expect(stats.code).toMatchObject({
		linesOfCodeChanged: 0,
		contributorReposCompleted: 0,
		contributorReposPending: 0,
	});
	expect(stats.collectionStatus.warnings).toContain(
		'Traffic metrics are missing; view coverage is unknown.',
	);
});

it('keeps disabled optional-metric coverage distinguishable from measured zero', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		repoMetrics: {
			...raw.repoMetrics,
			traffic: {
				repoViews: 0,
				repoViewUniques: 0,
				reposCompleted: 0,
				reposPending: 0,
				reposFailed: 0,
			},
		},
	});
	expect(stats.isComplete).toBe(false);
	expect(stats.collectionStatus.warnings).toContain(
		'Traffic metrics have no completed repository coverage.',
	);
});

it('does not hide missing contribution years behind a complete collection summary', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		profileContributions: {
			...raw.profileContributions,
			completeness: {
				complete: false,
				yearsFetched: ['2024'],
				yearsFromCache: [],
				missingYears: ['2023'],
			},
		},
	});
	expect(stats.collectionStatus).toMatchObject({
		complete: false,
		coreComplete: false,
	});
	expect(stats.collectionStatus.warnings).toContain(
		'Contribution history is incomplete; missing years: 2023.',
	);
});

it('retains collection errors and marks the profile incomplete', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats({
		...raw,
		collectionStatus: {...raw.collectionStatus, errors: ['traffic failed']},
	});
	expect(stats.isComplete).toBe(false);
	expect(stats.collectionStatus.errors).toEqual(['traffic failed']);
});

it('deduplicates a repeated profile calendar day at a year boundary', () => {
	const raw = createMinimalV2();
	const calendar = raw.profileContributions.contributionCalendar;
	const stats = normalizeGithubStats({
		...raw,
		profileContributions: {
			...raw.profileContributions,
			contributionCalendar: {
				...calendar,
				weeks: [
					...calendar.weeks,
					{contributionDays: [{date: '2024-01-04', contributionCount: 3}]},
				],
			},
		},
	});
	expect(stats.contributions.calendar).toHaveLength(4);
	expect(stats.contributions.calendar.at(-1)).toEqual({
		date: '2024-01-04',
		contributionCount: 3,
	});
});

it('supports full versionless legacy data without claiming unreported coverage', () => {
	const stats = normalizeGithubStats(createFullV2().legacy);
	expect(stats).toMatchObject({
		schemaVersion: null,
		username: 'octocat',
		totalCommits: 9,
		isComplete: false,
	});
	expect(stats.collectionStatus).toMatchObject({
		complete: false,
		coreComplete: false,
	});
	expect(stats.collectionStatus.warnings).toContain(
		'Legacy stats do not report collection or optional-metric coverage.',
	);
});

it('uses known computed repository counts when a legacy repoStats group is partial', () => {
	const legacy = createFullV2().legacy;
	const stats = normalizeGithubStats({...legacy, repoStats: {activeRepos: 0}});
	expect(stats.repositories).toMatchObject({
		totalRepos: 1,
		publicRepos: 1,
		originalRepos: 1,
		activeRepos: 0,
	});
	expect(stats.summary).toMatchObject({totalRepos: 1, activeRepos: 0});
});

it('accepts explicit zero legacy counters without inventing collection completeness', () => {
	const stats = normalizeGithubStats({
		username: 'new-user',
		fetchedAt,
		totalContributions: 0,
		totalCommits: 0,
	});
	expect(stats).toMatchObject({
		username: 'new-user',
		totalContributions: 0,
		totalCommits: 0,
		isComplete: false,
	});
});

it('supports explicit compact legacy aliases without a current-time fallback', () => {
	const stats = normalizeGithubStats({
		username: 'octocat',
		fetchedAt,
		totalContributions: 3,
		commitCount: 2,
		topLanguages: [{name: 'Go', bytes: 10}],
		linesAdded: 5,
		linesDeleted: 2,
	});
	expect(stats).toMatchObject({
		generatedAt,
		fetchedAt,
		totalCommits: 2,
		codeByteTotal: 10,
		linesChanged: 7,
		linesOfCodeChanged: 7,
	});
	expect(stats.topLanguages).toEqual([
		{languageName: 'Go', value: 10, color: null, percentage: 100},
	]);
});

it.each([
	null,
	{},
	{error: 'Not Found'},
	{schemaVersion: 3},
	{username: 'octocat', totalCommits: '2'},
])(
	'rejects malformed external data instead of returning a complete zero profile: %j',
	(raw) => {
		expect(() => normalizeGithubStats(raw)).toThrow();
	},
);

it('refuses private repository details even when the privacy flag is false', () => {
	const raw = createFullV2();
	expect(() =>
		normalizeGithubStats({
			...raw,
			repositories: [{...raw.repositories[0], isPrivate: true}],
		}),
	).toThrow('private repository details');
});

it('checks legacy top repositories for private details', () => {
	const legacy = createFullV2().legacy;
	expect(() =>
		normalizeGithubStats({
			...legacy,
			topRepos: [{...legacy.topRepos[0], isPrivate: true}],
		}),
	).toThrow('private repository details');
});

it('retains private-detail provenance when rendering is explicitly allowed', () => {
	const raw = createFullV2();
	const stats = normalizeGithubStats(
		{...raw, repositories: [{...raw.repositories[0], isPrivate: true}]},
		{allowPrivateRepositoryDetails: true},
	);
	expect(stats.privacy.privateRepositoryDetailsIncluded).toBe(true);
});

it('validates normalized UserStats on a distinct path', () => {
	const stats = normalizeGithubStats(createFullV2());
	expect(normalizeUserStats(stats)).toEqual(stats);
	expect(() => normalizeGithubStats(stats)).toThrow();
});

it('repairs normalized aliases from the authoritative nested metrics', () => {
	const stats = normalizeGithubStats(createFullV2());
	expect(
		normalizeUserStats({
			...stats,
			totalCommits: 0,
			summary: {...stats.summary, totalContributions: 0},
		}),
	).toMatchObject({
		totalCommits: 9,
		summary: {totalContributions: 12},
	});
});

it('keeps missing normalized calendars identifiable despite optimistic completeness flags', () => {
	const stats = normalizeGithubStats(createFullV2());
	const normalized = normalizeUserStats({
		...stats,
		contributions: {...stats.contributions, calendar: []},
	});
	expect(normalized).toMatchObject({
		isComplete: false,
		collectionStatus: {complete: false, coreComplete: false},
	});
	expect(normalized.collectionStatus.warnings).toContain(
		'Contribution calendar does not cover the reported total.',
	);
});

it('rejects invalid normalized field values at the same boundary as source props', () => {
	const stats = normalizeGithubStats(createFullV2());
	expect(() =>
		normalizeUserStats({
			...stats,
			community: {...stats.community, followers: -1},
		}),
	).toThrow();
});

it('rejects unknown schema versions on the normalized input path', () => {
	expect(() =>
		normalizeUserStats({
			...normalizeGithubStats(createFullV2()),
			schemaVersion: 3,
		}),
	).toThrow('Unsupported stats schema version');
});

it('rejects impossible language byte totals on the normalized input path', () => {
	const stats = normalizeGithubStats(createFullV2());
	expect(() =>
		normalizeUserStats({...stats, code: {...stats.code, codeByteTotal: 0}}),
	).toThrow('Language bytes exceed codeByteTotal');
});

it('does not let normalized private data bypass the public boundary', () => {
	const stats = normalizeGithubStats(createFullV2());
	expect(() =>
		normalizeUserStats({
			...stats,
			privacy: {...stats.privacy, privateRepositoryDetailsIncluded: true},
		}),
	).toThrow('private repository details');
});

it('recalculates every language percentage against the supplied total', () => {
	expect(
		normalizeLanguages(
			[
				{languageName: 'Go', color: null, value: 20, percentage: 100},
				{languageName: 'Rust', color: null, value: 30, percentage: 100},
			],
			100,
		),
	).toEqual([
		{languageName: 'Rust', color: null, value: 30, percentage: 30},
		{languageName: 'Go', color: null, value: 20, percentage: 20},
	]);
});

it('rejects inconsistent language bytes rather than publishing impossible percentages', () => {
	expect(() =>
		normalizeLanguages([{languageName: 'Go', color: null, value: 10}], 0),
	).toThrow('Language bytes exceed codeByteTotal');
});
