import {mkdtemp, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {renderCards} from './api';

const outputDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		outputDirectories
			.splice(0)
			.map((path) => rm(path, {recursive: true, force: true})),
	);
});

describe('renderCards', () => {
	it('removes temporary files when Remotion fails', async () => {
		const outputDir = await mkdtemp(join(tmpdir(), 'diffler-render-test-'));
		outputDirectories.push(outputDir);
		const propsBefore = await listPropsFiles();

		await expect(
			renderCards({
				compositionIds: ['missing-composition'],
				entryPoint: join(outputDir, 'missing-entry-point.tsx'),
				formats: ['webp'],
				outputDir,
				props: {},
			}),
		).rejects.toThrow();

		expect(await listPropsFiles()).toEqual(propsBefore);
		await expect(readdir(join(outputDir, '.tmp'))).rejects.toThrow();
	}, 30_000);
});

async function listPropsFiles() {
	return (await readdir(tmpdir()))
		.filter((name) => name.startsWith('remotion-props-'))
		.sort();
}
