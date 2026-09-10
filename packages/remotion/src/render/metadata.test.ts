import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {calculateCardMetadata} from '../Root';
import {defaultStats} from '../data/defaultStats';
import type {CompositionInputProps} from './input';

const sourceStats = {
	username: 'source-user',
	name: 'Source Person',
	fetchedAt: 1_700_000_000_000,
	totalContributions: 42,
	totalCommits: 7,
};

function metadata(props: CompositionInputProps) {
	return calculateCardMetadata({
		props,
		defaultProps: {userStats: {...defaultStats, name: 'Not the Studio edit'}},
		abortSignal: new AbortController().signal,
		compositionId: 'stats',
		isRendering: true,
	});
}

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockRejectedValue(new Error('Unexpected network request')),
	);
});

afterEach(() => vi.unstubAllGlobals());

describe('composition metadata boundary', () => {
	it('uses the actual callback props, preserving Studio edits without a network request', async () => {
		const result = await metadata({
			userStats: {
				...structuredClone(defaultStats),
				name: 'Studio Edit',
				username: 'studio-user',
			},
			theme: 'github',
		});
		expect(result.props).toMatchObject({
			userStats: {name: 'Studio Edit', username: 'studio-user'},
			theme: 'github',
		});
		expect(result.props).not.toHaveProperty('defaultProps');
		expect(result.props).not.toHaveProperty('props');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('resolves inline raw stats through the shared data boundary', async () => {
		const result = await metadata({stats: sourceStats, theme: 'github'});
		expect(result.props).toMatchObject({
			userStats: {username: 'source-user', totalCommits: 7},
			theme: 'github',
		});
		expect(result.props).not.toHaveProperty('stats');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('lets an explicit source replace normalized defaults when Studio changes the source', async () => {
		const result = await metadata({
			userStats: defaultStats,
			stats: sourceStats,
		});
		expect(result.props?.userStats?.name).toBe('Source Person');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('resolves a URL once and does not refetch already-resolved props', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(sourceStats)),
		);
		const first = await metadata({statsUrl: 'https://example.test/stats.json'});
		expect(first.props).not.toHaveProperty('statsUrl');
		const second = await metadata(first.props!);
		expect(second.props?.userStats?.username).toBe('source-user');
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('rejects a failed source instead of rendering default or placeholder stats', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response('unavailable', {status: 503}),
		);
		await expect(
			metadata({statsUrl: 'https://example.test/unavailable.json'}),
		).rejects.toThrow(/503/);
	});

	it('rejects missing or malformed stats before requesting external data', async () => {
		await expect(metadata({})).rejects.toThrow(/Provide/);
		await expect(
			// @ts-expect-error Exercise malformed JSON supplied by a consumer.
			metadata({userStats: {name: 'incomplete'}}),
		).rejects.toThrow();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('applies the shared privacy guard to supplied normalized stats as well as sources', async () => {
		const userStats = {
			...defaultStats,
			privacy: {
				...defaultStats.privacy,
				privateRepositoryDetailsIncluded: true,
			},
		};
		await expect(metadata({userStats})).rejects.toThrow(/private/i);
		const result = await metadata({
			userStats,
			allowPrivateRepositoryDetails: true,
		});
		expect(
			result.props?.userStats?.privacy.privateRepositoryDetailsIncluded,
		).toBe(true);
		expect(fetch).not.toHaveBeenCalled();
	});
});
