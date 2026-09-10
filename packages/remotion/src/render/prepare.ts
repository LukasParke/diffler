import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join} from 'node:path';
import {resolveRenderProps} from './input';
import {assertReplaceable, outputDirectory, resolvePath} from './paths';
import {publishFiles} from './publish';

export interface PrepareStatsConfig {
	props: Record<string, unknown>;
	outputPath: string;
}

/** Resolve and validate through the same public-safety boundary as rendering. */
export async function prepareStats({
	props,
	outputPath,
}: PrepareStatsConfig): Promise<void> {
	const destination = resolvePath(outputPath, 'outputPath');
	const directory = await outputDirectory(dirname(destination));
	await assertReplaceable(destination);
	const resolvedProps = await resolveRenderProps(props);
	const workDir = await mkdtemp(join(tmpdir(), 'diffler-prepare-'));
	try {
		const staged = join(workDir, 'input.json');
		await writeFile(
			staged,
			`${JSON.stringify(resolvedProps, null, 2)}\n`,
			'utf8',
		);
		await publishFiles(directory, [
			{name: basename(destination), path: staged},
		]);
	} finally {
		await rm(workDir, {recursive: true, force: true});
	}
}
