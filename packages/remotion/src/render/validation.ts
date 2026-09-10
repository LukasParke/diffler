import {join} from 'node:path';
import type {WebpackOverrideFn} from '@remotion/bundler';
import {cardIds} from '@lukasparke/diffler-schemas';
import {z} from 'zod';
import {assertReplaceable, inputFile, outputDirectory} from './paths';

const nonEmptyString = z
	.string()
	.refine(
		(value) => value.trim().length > 0 && !value.includes('\0'),
		'Must not be empty or contain null bytes',
	);
const frame = z.number().int().nonnegative();
export const renderConfigSchema = z
	.object({
		compositionIds: z
			.array(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/))
			.min(1),
		entryPoint: nonEmptyString,
		formats: z.array(z.enum(['gif', 'webp', 'png'])).min(1),
		outputDir: nonEmptyString,
    props: z.record(z.string(), z.unknown()),
		concurrency: z.number().int().min(1).max(8).default(1),
		remotionConcurrency: z.number().int().min(1).max(16).default(1),
		frameRange: z
			.tuple([frame, frame])
			.refine(
				([start, end]) => start <= end,
				'frameRange must be an inclusive [start, end] range in ascending order',
			)
			.optional(),
		stillFrame: frame.optional(),
		scale: z.number().int().min(1).max(4).default(2),
		playback: z.enum(['once', 'loop']).optional(),
		browserExecutable: nonEmptyString.optional(),
		ffmpegExecutable: nonEmptyString.default('ffmpeg'),
		webpackOverride: z
			.custom<WebpackOverrideFn>(
				(value) => typeof value === 'function',
				'webpackOverride must be a function',
			)
			.optional(),
	})
	.strict();

export type ValidatedRenderConfig = z.infer<typeof renderConfigSchema>;

export async function validateRenderConfig(
	value: unknown,
): Promise<ValidatedRenderConfig> {
	const config = renderConfigSchema.parse(value);
	const knownIds = new Set<string>(cardIds);
	for (const id of config.compositionIds) {
		if (!knownIds.has(id)) {
			throw new Error(
				`Unknown card: ${id}. Available cards: ${[...knownIds].join(', ')}`,
			);
		}
	}
	if (new Set(config.compositionIds).size !== config.compositionIds.length) {
		throw new Error('compositionIds must not contain duplicate cards');
	}
	if (new Set(config.formats).size !== config.formats.length) {
		throw new Error('formats must not contain duplicates');
	}
	if (config.concurrency * config.remotionConcurrency > 32) {
		throw new Error('concurrency × remotionConcurrency must not exceed 32');
	}
	if (config.stillFrame !== undefined && !config.formats.includes('png')) {
		throw new Error('stillFrame requires the png format');
	}
	if (config.frameRange && !config.formats.some((format) => format !== 'png')) {
		throw new Error(
			'frameRange requires an animated format; use stillFrame for png',
		);
	}
	config.entryPoint = await inputFile(config.entryPoint, 'entryPoint');
	config.outputDir = await outputDirectory(config.outputDir);
	if (config.browserExecutable) {
		config.browserExecutable = await inputFile(
			config.browserExecutable,
			'browserExecutable',
			true,
		);
	}
	if (/[\\/]/.test(config.ffmpegExecutable)) {
		config.ffmpegExecutable = await inputFile(
			config.ffmpegExecutable,
			'ffmpegExecutable',
			true,
		);
	} else if (config.ffmpegExecutable.startsWith('-')) {
		throw new Error(
			'ffmpegExecutable must be a command name or an executable path',
		);
	}
	for (const id of config.compositionIds) {
		for (const format of config.formats) {
			await assertReplaceable(join(config.outputDir, `${id}.${format}`));
		}
	}
	await assertReplaceable(join(config.outputDir, 'index.html'));
	return config;
}
