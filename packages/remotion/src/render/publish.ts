import {
	copyFile,
	mkdir,
	mkdtemp,
	open,
	rename,
	rm,
	unlink,
} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {assertReplaceable, fileInfo, outputDirectory} from './paths';

export type GeneratedFile = {name: string; path: string};

/**
 * Copy complete outputs onto the destination filesystem, then atomically replace
 * only those files. Backups allow a failed multi-file publish to roll back. The
 * lock prevents two cooperating renders from rolling back each other's files.
 */
export async function publishFiles(
	outputDir: string,
	files: GeneratedFile[],
): Promise<void> {
	await validateGeneratedFiles(files);

	const destination = await outputDirectory(outputDir);
	await mkdir(destination, {recursive: true});
	const lockPath = join(destination, '.diffler-publish.lock');
	const lock = await open(lockPath, 'wx', 0o600).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'EEXIST') {
				throw new Error(
					`Another publication holds ${lockPath}. Do not remove an active lock.`,
				);
			}
			throw error;
		},
	);
	let staging: string | undefined;
	let preserveBackups = false;
	const errors: unknown[] = [];
	const replacements: Array<{
		target: string;
		staged: string;
		backup?: string;
		published: boolean;
	}> = [];

	try {
		staging = await mkdtemp(join(destination, '.diffler-publish-'));
		for (const [index, file] of files.entries()) {
			const target = join(destination, file.name);
			const staged = join(staging, `new-${index}`);
			const previous = await assertReplaceable(target);
			const backup = previous ? join(staging, `previous-${index}`) : undefined;
			await copyFile(file.path, staged);
			if (backup) {
				await copyFile(target, backup);
			}
			replacements.push({target, staged, backup, published: false});
		}
		for (const replacement of replacements) {
			await rename(replacement.staged, replacement.target);
			replacement.published = true;
		}
	} catch (error) {
		errors.push(error);
		for (const replacement of replacements.slice().reverse()) {
			if (!replacement.published) continue;
			try {
				if (replacement.backup) {
					await rename(replacement.backup, replacement.target);
				} else {
					await unlink(replacement.target);
				}
			} catch (rollbackError) {
				// Do not destroy the only recovery copy if the filesystem itself fails.
				preserveBackups = true;
				errors.push(rollbackError);
			}
		}
		if (preserveBackups) {
			errors.push(
				new Error(
					`Publication rollback failed; recovery files remain in ${staging}`,
				),
			);
		}
	} finally {
		if (staging && !preserveBackups) {
			await rm(staging, {recursive: true, force: true}).catch((error) =>
				errors.push(error),
			);
		}
		await lock.close().catch((error) => errors.push(error));
		await unlink(lockPath).catch((error) => errors.push(error));
	}

	if (errors.length === 1) throw errors[0];
	if (errors.length > 1)
		throw new AggregateError(errors, 'Failed to publish generated assets');
}

async function validateGeneratedFiles(files: GeneratedFile[]) {
	if (
		files.length === 0 ||
		new Set(files.map(({name}) => name)).size !== files.length
	) {
		throw new Error(
			'Publication requires a non-empty set of unique output files',
		);
	}
	for (const {name, path} of files) {
		if (
			name !== basename(name) ||
			name === '.' ||
			name === '..' ||
			name.includes('\0')
		) {
			throw new Error(`Invalid output filename: ${name}`);
		}
		const info = await fileInfo(path);
		if (!info?.isFile() || info.size === 0) {
			throw new Error(`Render did not generate a non-empty output: ${name}`);
		}
	}
}
