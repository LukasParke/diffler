import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {calculateMetadata} from '../../../../examples/remotion-usage/src/Root';
import {defaultStats, type SourceProps} from '../data';

const defaults = {userStats: defaultStats};

function metadata(overrides: Partial<SourceProps>) {
	return calculateMetadata({
		props: {...defaults, ...overrides}, defaultProps: defaults,
		compositionId: 'readme', abortSignal: new AbortController().signal, isRendering: true,
	});
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request'))));
afterEach(() => vi.unstubAllGlobals());

it.each([{statsUrl: ''}, {usernames: []}])('rejects invalid explicit example sources instead of selecting demo defaults: %j', async (source) => {
	await expect(metadata(source)).rejects.toThrow();
	expect(fetch).not.toHaveBeenCalled();
});

it('applies the private-details guard to normalized example input', async () => {
	const userStats = {...defaultStats, privacy: {...defaultStats.privacy, privateRepositoryDetailsIncluded: true}};
	await expect(metadata({userStats})).rejects.toThrow(/private/i);
	const allowed = await metadata({userStats, allowPrivateRepositoryDetails: true});
	expect(allowed.props).toMatchObject({userStats: {privacy: {privateRepositoryDetailsIncluded: true}}, allowPrivateRepositoryDetails: true});
	expect(fetch).not.toHaveBeenCalled();
});
