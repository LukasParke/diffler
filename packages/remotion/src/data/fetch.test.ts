import {afterEach, expect, it, vi} from 'vitest';
import {createFullV2} from '../../../schemas/tests/fixtures';
import {
	defaultStats,
	demoStats,
	fetchUserStats,
	normalizeGithubStats,
	sourcePropsSchema,
} from './index';

afterEach(() => vi.unstubAllGlobals());

it('accepts already-normalized userStats without fetching or taking the legacy path', async () => {
	const fetch = vi.fn<typeof globalThis.fetch>();
	vi.stubGlobal('fetch', fetch);
	const userStats = normalizeGithubStats(createFullV2());
	expect(sourcePropsSchema.parse({userStats})).toEqual({userStats});
	expect(await fetchUserStats({userStats})).toEqual(userStats);
	expect(fetch).not.toHaveBeenCalled();
});

it('accepts validated inline raw stats without fetching', async () => {
	const fetch = vi.fn<typeof globalThis.fetch>();
	vi.stubGlobal('fetch', fetch);
	expect(await fetchUserStats({stats: createFullV2()})).toMatchObject({
		username: 'octocat',
		totalCommits: 9,
	});
	expect(fetch).not.toHaveBeenCalled();
});

it('prefers explicit raw stats over normalized composition defaults', async () => {
	expect(
		await fetchUserStats({stats: createFullV2(), userStats: demoStats}),
	).toMatchObject({username: 'octocat', totalCommits: 9});
});

it('prefers an explicit URL over a username and normalized composition defaults', async () => {
	const fetch = vi
		.fn<typeof globalThis.fetch>()
		.mockResolvedValue(new Response(JSON.stringify(createFullV2())));
	vi.stubGlobal('fetch', fetch);
	expect(
		await fetchUserStats({
			statsUrl: 'https://example.com/stats.json',
			username: 'ignored',
			userStats: demoStats,
		}),
	).toMatchObject({username: 'octocat'});
	expect(fetch).toHaveBeenCalledExactlyOnceWith(
		'https://example.com/stats.json',
		expect.objectContaining({
			headers: expect.objectContaining({accept: 'application/json'}),
		}),
	);
});

it('builds the documented username URL instead of using an implicit account', async () => {
	const fetch = vi
		.fn<typeof globalThis.fetch>()
		.mockResolvedValue(new Response(JSON.stringify(createFullV2())));
	vi.stubGlobal('fetch', fetch);
	await fetchUserStats({username: 'octocat'});
	expect(fetch).toHaveBeenCalledExactlyOnceWith(
		'https://raw.githubusercontent.com/octocat/stats/main/github-user-stats.json',
		expect.any(Object),
	);
});

it('merges profile commits while deduplicating shared canonical repository records', async () => {
	const first = createFullV2();
	const second = {
		...createFullV2(),
		profile: {...first.profile, name: 'Hubot', login: 'hubot'},
	};
	const fetch = vi
		.fn<typeof globalThis.fetch>()
		.mockResolvedValueOnce(new Response(JSON.stringify(first)))
		.mockResolvedValueOnce(new Response(JSON.stringify(second)));
	vi.stubGlobal('fetch', fetch);
	expect(await fetchUserStats({usernames: ['octocat', 'hubot']})).toMatchObject(
		{
			totalCommits: 18,
			totalContributions: 24,
			summary: {totalRepos: 1, languageCount: 6},
			repositories: {totalRepos: 1, trafficReposPending: 1},
			isComplete: false,
		},
	);
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(fetch).toHaveBeenNthCalledWith(
		2,
		'https://raw.githubusercontent.com/hubot/stats/main/github-user-stats.json',
		expect.any(Object),
	);
});

it('deduplicates shared package metrics and preserves incomplete registry coverage', async () => {
	const first = createFullV2();
	const downloads = {lastDay: 1, lastWeek: 4, lastMonth: 12, lastYear: 18, allTime: 24};
	first.packageMetrics = {
		packageCount: 1, providers: ['npm'], downloads,
		packages: [{provider: 'npm', name: 'example', url: 'https://www.npmjs.com/package/example', latestVersion: '1.0.0', latestPublishedAt: first.generatedAt, downloads}],
		complete: false, warnings: ['Historical download window missing'],
	};
	const second = {...first, profile: {...first.profile, login: 'hubot'}};
	vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>()
		.mockResolvedValueOnce(Response.json(first))
		.mockResolvedValueOnce(Response.json(second)));
	const stats = await fetchUserStats({usernames: ['octocat', 'hubot']});
	expect(stats.packages).toMatchObject({packageCount: 1, downloads, complete: false});
	expect(stats.packages.packages).toHaveLength(1);
	expect(stats.packages.warnings).toContain('Historical download window missing');
	expect(stats.isComplete).toBe(false);
});

it('rejects missing source props before attempting a default fetch', async () => {
	const fetch = vi.fn<typeof globalThis.fetch>();
	vi.stubGlobal('fetch', fetch);
	await expect(fetchUserStats({})).rejects.toThrow('Provide stats');
	expect(fetch).not.toHaveBeenCalled();
});

it('rejects duplicate profile sources before fetching', async () => {
	const fetch = vi.fn<typeof globalThis.fetch>();
	vi.stubGlobal('fetch', fetch);
	await expect(
		fetchUserStats({usernames: ['octocat', 'Octocat']}),
	).rejects.toThrow('Duplicate GitHub usernames');
	expect(fetch).not.toHaveBeenCalled();
});

it('does not replace malformed inline data with a valid normalized default', async () => {
	await expect(
		fetchUserStats({stats: null, userStats: demoStats}),
	).rejects.toThrow();
});

it('rejects malformed normalized data instead of treating it as legacy', async () => {
	await expect(
		fetchUserStats({
			userStats: {...demoStats, contributions: {totalCommits: 5}},
		}),
	).rejects.toThrow();
});

it('propagates HTTP errors instead of returning a fixture', async () => {
	vi.stubGlobal(
		'fetch',
		vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(new Response('Not found', {status: 404})),
	);
	await expect(
		fetchUserStats({
			statsUrl: 'https://example.com/missing.json',
			userStats: demoStats,
		}),
	).rejects.toThrow(
		'Failed to fetch stats from https://example.com/missing.json: 404',
	);
});

it('propagates network errors instead of returning a fixture', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('offline')),
	);
	await expect(fetchUserStats({username: 'octocat'})).rejects.toThrow(
		'offline',
	);
});

it('propagates malformed JSON responses', async () => {
	vi.stubGlobal(
		'fetch',
		vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(new Response('not JSON')),
	);
	await expect(fetchUserStats({username: 'octocat'})).rejects.toThrow(
		SyntaxError,
	);
});

it('rejects successful HTTP responses containing API errors', async () => {
	vi.stubGlobal(
		'fetch',
		vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(
				new Response(JSON.stringify({message: 'Bad credentials'})),
			),
	);
	await expect(fetchUserStats({username: 'octocat'})).rejects.toThrow();
});

it('rejects unknown schema versions received over HTTP', async () => {
	vi.stubGlobal(
		'fetch',
		vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(
				new Response(JSON.stringify({...createFullV2(), schemaVersion: 3})),
			),
	);
	await expect(fetchUserStats({username: 'octocat'})).rejects.toThrow();
});

it('requires explicit permission for normalized private repository details', async () => {
	const userStats = {
		...demoStats,
		privacy: {...demoStats.privacy, privateRepositoryDetailsIncluded: true},
	};
	await expect(fetchUserStats({userStats})).rejects.toThrow(
		'private repository details',
	);
	expect(
		await fetchUserStats({userStats, allowPrivateRepositoryDetails: true}),
	).toMatchObject({privacy: {privateRepositoryDetailsIncluded: true}});
});

it('exports defaultStats as an explicitly selected, deterministic demo fixture', async () => {
	expect(defaultStats).toBe(demoStats);
	expect(await fetchUserStats({userStats: defaultStats})).toEqual(defaultStats);
	expect(defaultStats.generatedAt).toBe('2026-05-29T00:00:00.000Z');
	expect(defaultStats.summary.refreshedAt).toBe('2026-05-29T00:00:00.000Z');
	expect(defaultStats.fetchedAt).toBe(1780012800000);
	expect(defaultStats.isComplete).toBe(false);
});
