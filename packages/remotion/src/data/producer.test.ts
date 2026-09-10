import {afterEach, expect, it, vi} from 'vitest';
import {buildOutput} from '../../../diffler/src/stats/output';
import {createEmptyStableCache} from '../../../diffler/src/stats/cache';
import {
	createContributionsCollection,
	createFullV2,
	fetchedAt,
	generatedAt,
} from '../../../schemas/tests/fixtures';
import {githubStatsOutputSchema, normalizeGithubStats} from './index';

afterEach(() => vi.useRealTimers());

it('validates and adapts actual producer JSON with profile commits and pending repo backfill', () => {
	vi.useFakeTimers();
	vi.setSystemTime(generatedAt);
	const fixture = createFullV2();
	const cache = createEmptyStableCache();
	cache.backfill.pending = [
		{
			key: 'contributors:R_PUBLIC',
			type: 'contributors',
			repoId: 'R_PUBLIC',
			nameWithOwner: 'octocat/hello',
			priority: 1,
			reason: 'missing',
		},
		{
			key: 'traffic:R_PUBLIC',
			type: 'traffic',
			repoId: 'R_PUBLIC',
			nameWithOwner: 'octocat/hello',
			priority: 1,
			reason: 'missing',
		},
	];
	const output = buildOutput({
		profile: fixture.profile,
		activity: fixture.activity,
		contributions: {
			collection: createContributionsCollection(),
			repositoryContributions: [],
			repositories: fixture.repositories,
			yearsFetched: ['2024'],
			yearsFromCache: [],
			missingYears: [],
		},
		repositories: fixture.repositories,
		cache,
		config: {
			outputPath: 'stats.json',
			cachePath: 'cache.json',
			volatileCachePath: 'volatile.json',
			maxRuntimeSeconds: 10,
			graphqlConcurrency: 1,
			restConcurrency: 1,
			minGraphqlRemaining: 0,
			minRestRemaining: 0,
			includeTraffic: true,
      includeRestRepoStats: true,
      includePrivateRepositoryMetrics: false,
			includePrivateRepositoryDetails: false,
			includePrivateCacheDetails: false,
      backfillMode: 'resume',
      packageSources: [],
		},
		collectionStatus: {
			...fixture.collectionStatus,
			complete: false,
			backfill: {
				...fixture.collectionStatus.backfill,
				completedThisRun: 0,
				pending: 2,
			},
		},
		fetchedAt,
	});
	const wire: unknown = JSON.parse(JSON.stringify(output));
	expect(githubStatsOutputSchema.parse(wire)).toEqual(output);
	const stats = normalizeGithubStats(wire);
	expect(stats).toMatchObject({
		totalCommits: 9,
		totalContributions: 12,
		isComplete: false,
		contributions: {
			totalCommits: 9,
			currentStreak: 2,
			peakDay: {date: '2024-01-03', contributions: 5},
		},
		code: {
			linesOfCodeChanged: 0,
			contributorReposCompleted: 0,
			contributorReposPending: 1,
		},
		repositories: {trafficReposCompleted: 0, trafficReposPending: 1},
		collectionStatus: {complete: false, coreComplete: true, backfillPending: 2},
	});
	expect(stats.topLanguages).toHaveLength(6);
});
