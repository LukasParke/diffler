import {constants} from 'node:fs';
import {access, lstat, stat} from 'node:fs/promises';
import {parse, resolve} from 'node:path';

export function resolvePath(value: string, label: string): string {
	if (
		typeof value !== 'string' ||
		value.trim() === '' ||
		value.includes('\0')
	) {
		throw new Error(`${label} must be a non-empty path without null bytes`);
	}
	return resolve(value);
}

export async function fileInfo(path: string) {
	try {
		return await lstat(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}

export async function inputFile(
	value: string,
	label: string,
	executable = false,
) {
	const path = resolvePath(value, label);
	const info = await stat(path).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') {
			throw new Error(`${label} does not exist: ${path}`);
		}
		throw error;
	});
	if (!info.isFile()) {
		throw new Error(`${label} must be a file: ${path}`);
	}
	await access(path, executable ? constants.X_OK : constants.R_OK);
	return path;
}

export async function outputDirectory(value: string) {
	const path = resolvePath(value, 'outputDir');
	if (path === parse(path).root) {
		throw new Error('outputDir must not be a filesystem root');
	}
	const info = await fileInfo(path);
	if (info && (!info.isDirectory() || info.isSymbolicLink())) {
		throw new Error(
			`outputDir must be a directory, not a file or symlink: ${path}`,
		);
	}
	return path;
}

export async function assertReplaceable(path: string) {
	const info = await fileInfo(path);
	if (info && (!info.isFile() || info.isSymbolicLink())) {
		throw new Error(`Refusing to replace a non-file or symlink: ${path}`);
	}
	return info;
}
