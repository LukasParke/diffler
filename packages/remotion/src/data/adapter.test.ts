import {describe, expect, it} from 'vitest';
import {normalizeGithubStats} from './adapter';

describe('normalizeGithubStats', () => {
	it('prefers profile-scoped repository metrics over repository-universe metrics', () => {
		const stats = normalizeGithubStats(
			{
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
						publicRepos: 261,
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
				collectionStatus: {},
				activity: {},
				repositories: [
					{
						owner: 'LukasParke',
						sources: ['owned'],
						isPrivate: false,
						isFork: false,
						isArchived: false,
						pushedAt: '2026-08-14T00:00:00.000Z',
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
						pushedAt: '2026-08-14T00:00:00.000Z',
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
						pushedAt: '2026-08-14T00:00:00.000Z',
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
			},
			{allowPrivateRepositoryDetails: false},
		);

		expect(stats.summary).toMatchObject({
			totalRepos: 2,
			activeRepos: 1,
			languageCount: 1,
			starsReceived: 10,
			forksReceived: 2,
		});
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
	});
});
