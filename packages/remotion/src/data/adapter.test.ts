import {describe, expect, it} from 'vitest';
import {normalizeGithubStats} from './adapter';

describe('normalizeGithubStats', () => {
	it('prefers profile-scoped repository metrics over repository-universe metrics', () => {
		const currentTimestamp = `${new Date().getFullYear()}-01-01T00:00:00.000Z`;
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
		const stats = normalizeGithubStats(
			raw,
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
		});
		expect(contributedOnly.topLanguages).toEqual([]);

		const explicitProfile = normalizeGithubStats(
			{
				...raw,
				repoMetrics: {
					...raw.repoMetrics,
					profile: {
						publicRepos: 7,
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
			totalRepos: 7,
			activeRepos: 5,
			languageCount: 1,
			starsReceived: 99,
			forksReceived: 12,
		});
		expect(explicitProfile.topLanguages[0]?.languageName).toBe('Go');
	});
});
