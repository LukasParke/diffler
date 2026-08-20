import {describe, expect, it} from 'vitest';
import {normalizeGithubStats} from './adapter';

describe('normalizeGithubStats (canonical v2)', () => {
	it('maps a schema-valid canonical document without coercion', () => {
		const canonical = {
			schemaVersion: 2,
			generatedAt: '2026-08-14T00:00:00.000Z',
			profile: {
				name: 'Luke',
				login: 'LukasParke',
				bio: 'hi',
				company: null,
				location: null,
				email: null,
				twitterUsername: null,
				websiteUrl: 'https://parke.dev',
				avatarUrl: 'https://github.com/LukasParke.png',
				createdAt: '2020-01-01T00:00:00.000Z',
				followers: 70,
				following: 10,
			},
			profileContributions: {
				totalContributions: 123,
				totalCommitContributions: 100,
				restrictedContributionsCount: 3,
				totalIssueContributions: 5,
				totalRepositoryContributions: 5,
				totalPullRequestContributions: 8,
				totalPullRequestReviewContributions: 2,
				contributionCalendar: {
					totalContributions: 123,
					weeks: [
						{
							contributionDays: [
								{contributionCount: 3, date: '2026-06-01'},
							],
						},
					],
				},
				stats: {
					longestStreak: 9,
					currentStreak: 4,
					mostActiveDay: 'Tuesday',
					averagePerDay: 1.5,
					averagePerWeek: 10.5,
					averagePerMonth: 45,
					monthlyBreakdown: [{month: '2026-06', contributions: 3}],
					yearlyBreakdown: [{year: '2026', contributions: 123}],
					peakDay: {date: '2026-06-01', contributions: 3},
				},
				repositoryContributions: [],
				completeness: {
					complete: true,
					yearsFetched: ['2026'],
					yearsFromCache: [],
					missingYears: [],
				},
			},
			activity: {
				totalPullRequests: 12,
				openIssues: 1,
				closedIssues: 2,
				repositoriesContributedTo: 6,
				discussionsStarted: 1,
				discussionsAnswered: 2,
				starsGiven: 30,
			},
			repositories: [],
			repoMetrics: {
				starCount: 500,
				forkCount: 40,
				codeByteTotal: 9000,
				topLanguages: [
					{languageName: 'TypeScript', color: '#3178c6', value: 9000, percentage: 100},
				],
				topTopics: [],
				profile: {
					totalRepos: 30,
					publicRepos: 28,
					privateRepos: 2,
					originalRepos: 25,
					forkedRepos: 5,
					activeOriginalRepos: 12,
					archivedOriginalRepos: 3,
					reposWithStars: 9,
					starsReceived: 500,
					forksReceived: 40,
					codeByteTotal: 8000,
					topLanguages: [
						{languageName: 'TypeScript', color: '#3178c6', value: 8000, percentage: 100},
					],
				},
				contributorStats: {
					totalCommits: 90,
					linesAdded: 400,
					linesDeleted: 100,
					linesOfCodeChanged: 500,
					reposCompleted: 7,
					reposPending: 1,
					reposFailed: 0,
				},
				traffic: {
					repoViews: 210,
					repoViewUniques: 90,
					reposCompleted: 3,
					reposPending: 0,
					reposFailed: 0,
				},
				repoStats: {
					totalRepos: 30,
					publicRepos: 28,
					privateRepos: 2,
					archivedRepos: 3,
					forkedRepos: 5,
					originalRepos: 25,
					activeRepos: 12,
					reposWithStars: 9,
					reposCreatedThisYear: 2,
					averageStarsPerRepo: 16.67,
				},
				computedStats: {
					totalRepos: 30,
					publicRepos: 28,
					privateRepos: 2,
					archivedRepos: 3,
					forkedRepos: 5,
					originalRepos: 25,
					activeRepos: 12,
					reposWithStars: 9,
					reposCreatedThisYear: 2,
					averageStarsPerRepo: 16.67,
					languageCount: 1,
					primaryLanguage: 'TypeScript',
					primaryLanguageThisYear: 'TypeScript',
					topLanguagesThisYear: [],
					totalTopics: 0,
					topTopics: [],
					allTopics: [],
					contributionsThisYear: 123,
					contributionsLastYear: 100,
					yearOverYearGrowth: 23,
					mostProductiveMonth: {month: '2026-06', contributions: 3},
				},
			},
			packageMetrics: {
				packageCount: 0,
				providers: [],
				downloads: {lastDay: 0, lastWeek: 0, lastMonth: 0, lastYear: 0, allTime: 0},
				packages: [],
				complete: true,
				warnings: [],
			},
			presentation: {
				readmeSummary: {
					name: 'Luke',
					username: 'LukasParke',
					totalContributions: 123,
					currentStreak: 4,
					longestStreak: 9,
					topLanguages: [
						{languageName: 'TypeScript', color: '#3178c6', value: 8000, percentage: 100},
					],
					starsReceived: 500,
					forksReceived: 40,
					totalRepos: 30,
					originalRepos: 25,
					activeRepos: 12,
					languageCount: 1,
					codeByteTotal: 8000,
					refreshedAt: '2026-08-14T00:00:00.000Z',
					complete: true,
				},
				cards: [{id: 'c1', label: 'Card', value: 1}],
				timeline: [{period: '2026', contributions: 123}],
				highlights: [],
				remotion: {scenes: []},
			},
			privacy: {
				privateRepositoryMetricsIncluded: false,
				privateRepositoryDetailsIncluded: false,
				privateCacheDetailsIncluded: false,
				redactedPrivateRepositories: 0,
				redactedRepositoryContributions: 0,
				redactedOptionalMetrics: 0,
			},
			collectionStatus: {
				startedAt: 1,
				finishedAt: 2,
				durationMs: 1,
				complete: true,
				coreComplete: true,
				cache: {
					stablePath: 'a',
					volatilePath: 'b',
					contributionYearsFromCache: 0,
					contributionYearsFetched: 1,
					repositoriesFromCache: 0,
					repositoriesFetched: 0,
				},
				backfill: {
					enabled: true,
					completedThisRun: 0,
					pending: 0,
					failedThisRun: 0,
					skippedThisRun: 0,
				},
				rateLimit: {graphql: null, rest: null},
				warnings: [],
				errors: [],
			},
		};

		const stats = normalizeGithubStats(canonical, {
			allowPrivateRepositoryDetails: false,
		});

		expect(stats.schemaVersion).toBe(2);
		expect(stats.name).toBe('Luke');
		expect(stats.username).toBe('LukasParke');
		expect(stats.isComplete).toBe(true);
		expect(stats.summary).toMatchObject({
			totalContributions: 123,
			currentStreak: 4,
			longestStreak: 9,
			starsReceived: 500,
			forksReceived: 40,
			totalRepos: 30,
			activeRepos: 12,
			profileMetricsComplete: true,
		});
		expect(stats.contributions.totalCommits).toBe(90);
		expect(stats.contributions.calendar).toEqual([
			{contributionCount: 3, date: '2026-06-01'},
		]);
		expect(stats.community.totalPullRequests).toBe(12);
		expect(stats.community.starsGiven).toBe(30);
		expect(stats.repositories.repoViews).toBe(210);
		expect(stats.topLanguages[0]?.languageName).toBe('TypeScript');
		expect(stats.cards).toEqual([{id: 'c1', label: 'Card', value: 1}]);
		expect(stats.code.linesOfCodeChanged).toBe(500);
	});

	it('rejects private repository details before parsing', () => {
		expect(() =>
			normalizeGithubStats(
				{
					schemaVersion: 2,
					repositories: [{isPrivate: true}],
				},
				{allowPrivateRepositoryDetails: false},
			),
			).toThrow(/private/i);
		});
});

describe('normalizeGithubStats', () => {
	it('prefers profile-scoped repository metrics over repository-universe metrics', () => {
		const currentTimestamp = '2026-01-01T00:00:00.000Z';
		const raw = {
				schemaVersion: 2,
				generatedAt: '2026-08-14T00:00:00.000Z',
				profile: {
					name: 'Luke Parke',
					login: 'LukasParke',
					followers: 70,
				},
				legacy: {
					fetchedAt: Date.parse('2026-08-14T00:00:00.000Z'),
					contributionStats: {},
				},
				profileContributions: {
					contributionCalendar: {weeks: []},
				},
				presentation: {
					readmeSummary: {
						activeRepos: 152,
						starsReceived: 10,
						forksReceived: 2,
						topLanguages: [
							{
								languageName: 'HTML',
								color: '#e34c26',
								value: 100000,
								percentage: 99,
							},
						],
					},
					timeline: [],
					cards: [],
					highlights: [],
				},
				repoMetrics: {
					repoStats: {
						totalRepos: 303,
					publicRepos: 2,
						privateRepos: 42,
						activeRepos: 152,
						archivedRepos: 5,
						forkedRepos: 77,
						originalRepos: 226,
						reposWithStars: 149,
					},
					computedStats: {
						languageCount: 65,
					},
					contributorStats: {},
					traffic: {},
				},
				privacy: {},
			collectionStatus: {coreComplete: true},
				activity: {},
				repositories: [
					{
						owner: 'LukasParke',
						sources: ['owned'],
						isPrivate: false,
						isFork: false,
						isArchived: false,
						pushedAt: currentTimestamp,
						stars: 10,
						forks: 2,
						languages: [
							{
								languageName: 'Java',
								color: '#b07219',
								value: 3000,
							},
						],
					},
					{
						owner: 'LukasParke',
						sources: ['owned'],
						isPrivate: false,
						isFork: true,
						isArchived: false,
						pushedAt: currentTimestamp,
						stars: 50,
						forks: 10,
						languages: [
							{
								languageName: 'HTML',
								color: '#e34c26',
								value: 50000,
							},
						],
					},
					{
						owner: 'example',
						sources: ['contributed'],
						isPrivate: false,
						isFork: false,
						isArchived: false,
						pushedAt: currentTimestamp,
						stars: 10000,
						forks: 1000,
						languages: [
							{
								languageName: 'HTML',
								color: '#e34c26',
								value: 100000,
							},
						],
					},
				],
			};
		const stats = normalizeGithubStats(raw, {
			allowPrivateRepositoryDetails: false,
		});

		expect(stats.summary).toMatchObject({
			totalRepos: 2,
			activeRepos: 1,
			languageCount: 1,
			starsReceived: 10,
			forksReceived: 2,
			profileMetricsComplete: true,
		});
		expect(stats.repositories.repoViews).toBeNull();
		expect(stats.repositories).toMatchObject({
			totalRepos: 2,
			publicRepos: 2,
			privateRepos: 0,
			originalRepos: 1,
			forkedRepos: 1,
			activeRepos: 1,
		});
		expect(stats.code.codeByteTotal).toBe(3000);
		expect(stats.topLanguages[0]?.languageName).toBe('Java');

		const contributedOnly = normalizeGithubStats(
			{...raw, repositories: [raw.repositories[2]]},
			{allowPrivateRepositoryDetails: false},
		);
		expect(contributedOnly.summary).toMatchObject({
			totalRepos: 0,
			activeRepos: 0,
			languageCount: 0,
			starsReceived: 0,
			forksReceived: 0,
			profileMetricsComplete: false,
		});
		expect(contributedOnly.topLanguages).toEqual([]);

		const explicitProfile = normalizeGithubStats(
			{
				...raw,
				privacy: {privateRepositoryMetricsIncluded: true},
				repoMetrics: {
					...raw.repoMetrics,
					profile: {
						totalRepos: 9,
						publicRepos: 7,
						privateRepos: 2,
						originalRepos: 6,
						forkedRepos: 1,
						activeOriginalRepos: 5,
						archivedOriginalRepos: 1,
						reposWithStars: 4,
						starsReceived: 99,
						forksReceived: 12,
						codeByteTotal: 2000,
						languageCount: 1,
						topLanguages: [
							{
								languageName: 'Go',
								color: '#00ADD8',
								value: 2000,
								percentage: 100,
							},
						],
					},
				},
			},
			{allowPrivateRepositoryDetails: false},
		);
		expect(explicitProfile.summary).toMatchObject({
			totalRepos: 9,
			activeRepos: 5,
			languageCount: 1,
			starsReceived: 99,
			forksReceived: 12,
			profileMetricsComplete: true,
		});
		expect(explicitProfile.repositories).toMatchObject({
			totalRepos: 9,
			publicRepos: 7,
			privateRepos: 2,
		});
		expect(explicitProfile.privacy.privateRepositoryMetricsIncluded).toBe(
			true,
		);
		expect(explicitProfile.topLanguages[0]?.languageName).toBe('Go');
	});

	it('does not derive profile metrics from an incomplete repository collection', () => {
		const raw = {
			schemaVersion: 2,
			generatedAt: '2024-08-14T00:00:00.000Z',
			profile: {login: 'octocat'},
			legacy: {contributionStats: {}},
			profileContributions: {contributionCalendar: {weeks: []}},
			presentation: {
				readmeSummary: {
					totalRepos: 99,
					activeRepos: 99,
					starsReceived: 999,
					topLanguages: [{languageName: 'Wrong', value: 999}],
				},
				timeline: [],
				cards: [],
				highlights: [],
			},
			repoMetrics: {
				repoStats: {publicRepos: 2},
				contributorStats: {},
				traffic: {reposCompleted: 0, repoViews: 0},
			},
			collectionStatus: {coreComplete: false},
			privacy: {},
			activity: {},
			repositories: [
				{
					owner: 'octocat',
					sources: ['owned'],
					isPrivate: false,
					isFork: false,
					pushedAt: '2024-01-01T00:00:00.000Z',
					stars: 10,
					languages: [{languageName: 'TypeScript', value: 100}],
				},
			],
		};

		const stats = normalizeGithubStats(raw, {
			allowPrivateRepositoryDetails: false,
		});

		expect(stats.summary).toMatchObject({
			totalRepos: 0,
			activeRepos: 0,
			starsReceived: 0,
			profileMetricsComplete: false,
		});
		expect(stats.topLanguages).toEqual([]);
		expect(stats.repositories.repoViews).toBeNull();
		expect(stats.repoViews).toBeNull();
	});

	it('normalizes provider-neutral package metrics', () => {
		const stats = normalizeGithubStats(
			{
				schemaVersion: 2,
				generatedAt: '2026-08-14T00:00:00.000Z',
				profile: {login: 'octocat'},
				legacy: {contributionStats: {}},
				profileContributions: {contributionCalendar: {weeks: []}},
				presentation: {readmeSummary: {}, timeline: [], cards: [], highlights: []},
				repoMetrics: {contributorStats: {}, traffic: {}, repoStats: {}},
				collectionStatus: {},
				privacy: {},
				activity: {},
				repositories: [],
				packageMetrics: {
					packageCount: 1,
					providers: ['npm'],
					downloads: {
						lastDay: 4,
						lastWeek: 28,
						lastMonth: 120,
						lastYear: 1440,
						allTime: 2000,
					},
					packages: [
						{
							provider: 'npm',
							name: '@example/tool',
							url: 'https://npmjs.com/package/example',
							latestVersion: '2.0.0',
							latestPublishedAt: '2026-08-01T00:00:00.000Z',
							downloads: {lastMonth: 120},
						},
					],
					complete: true,
					warnings: [],
				},
			},
			{allowPrivateRepositoryDetails: false},
		);

		expect(stats.packages).toMatchObject({
			packageCount: 1,
			providers: ['npm'],
			downloads: {lastMonth: 120, allTime: 2000},
			complete: true,
		});
		expect(stats.packages.packages[0]).toMatchObject({
			provider: 'npm',
			name: '@example/tool',
			latestVersion: '2.0.0',
			downloads: {lastDay: 0, lastMonth: 120},
		});
	});
});
