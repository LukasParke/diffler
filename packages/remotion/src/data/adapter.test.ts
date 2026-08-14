import {describe, expect, it} from 'vitest';
import {normalizeGithubStats} from './adapter';

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
});
