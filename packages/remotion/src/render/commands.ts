import {readFile} from 'node:fs/promises';
import {parseArgs, type ParseArgsConfig} from 'node:util';
import {cardIds} from '@lukasparke/diffler-schemas';
import {renderCards} from './api';
import {renderConfigSchema} from './validation';
import {fileInfo, inputFile, resolvePath} from './paths';
import {prepareStats} from './prepare';

const renderHelp = `Usage: github-readme-cards [options]
  --props FILE                    JSON source props or normalized {userStats}
                                  (default: input.generated.json, then input.json)
  --cards ID,ID                   Registry card IDs (default: all cards)
  --formats webp,gif,png           Output formats (default: webp,gif)
  --entry-point FILE              Remotion entry point (default: src/app.tsx)
  --out-dir DIR                   Destination (default: pages); unrelated files are kept
  --concurrency N                 Card workers, 1–8 (alias: --card-concurrency)
  --remotion-concurrency N        Frame workers per card, 1–16; total limit 32
  --frames START,END              Inclusive animation range
  --still-frame N                 PNG frame (default: last composition frame)
  --scale N                       Output pixel scale, 1–4 (default: 2)
  --playback once|loop             Override the card's intended playback
  --browser-executable FILE       Installed Chrome/Chromium
  --ffmpeg-executable FILE        FFmpeg with libwebp (default: ffmpeg on PATH)
  --help                         Show this help

RENDER_PROPS, RENDER_FORMATS, RENDER_OUT_DIR, RENDER_ENTRY_POINT,
RENDER_CARD_CONCURRENCY, REMOTION_CONCURRENCY, RENDER_SCALE, RENDER_PLAYBACK,
RENDER_BROWSER_EXECUTABLE and
RENDER_FFMPEG_EXECUTABLE provide defaults. FFmpeg is never downloaded.`;

const prepareHelp = `Usage: prepare-stats [options]
  --stats-url URL                 Public HTTP(S) stats JSON (or STATS_JSON_URL)
  --stats-file FILE               Local raw stats JSON (or STATS_JSON_FILE / STATS_JSON_PATH)
  --username NAME                 GitHub stats repository owner (or STATS_USERNAME)
  --usernames NAME,NAME           Aggregate owners (or STATS_USERNAMES)
  --out FILE                     Prepared props (default: input.generated.json;
                                  or RENDER_INPUT_PATH)
  --allow-private-repository-details true|false
                                  Explicit opt-in (or ALLOW_PRIVATE_REPOSITORY_DETAILS)
  --help                         Show this help

A real source is required. CLI source flags take precedence over environment
sources. Validation and privacy checks use the renderer's shared data boundary.`;

export async function runRenderCli(
	argv: string[] = process.argv.slice(2),
	env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
	const {values, help} = parseFlags(argv, [
		'props',
		'cards',
		'formats',
		'entry-point',
		'out-dir',
		'concurrency',
		'card-concurrency',
		'remotion-concurrency',
		'frames',
		'still-frame',
		'scale',
		'playback',
		'browser-executable',
		'ffmpeg-executable',
	]);
	if (help) {
		console.log(renderHelp);
		return;
	}
	if (values.has('concurrency') && values.has('card-concurrency')) {
		throw new Error('Use only one of --concurrency and --card-concurrency');
	}
	const compositionIds = values.has('cards')
		? parseList(values.get('cards')!, 'cards')
		: [...cardIds];
	const formats = parseList(
		values.get('formats') ?? env.RENDER_FORMATS ?? 'webp,gif',
		'formats',
	);
	const frameRange = values.has('frames')
		? parseFrames(values.get('frames')!)
		: undefined;
	const concurrency = integer(
		values.get('concurrency') ??
			values.get('card-concurrency') ??
			env.RENDER_CARD_CONCURRENCY,
		'concurrency',
	);
	const remotionConcurrency = integer(
		values.get('remotion-concurrency') ?? env.REMOTION_CONCURRENCY,
		'remotion-concurrency',
	);
	const stillFrame = integer(values.get('still-frame'), 'still-frame');
	const propsPath =
		values.get('props') ?? env.RENDER_PROPS ?? (await defaultPropsPath());
	const props = await readJson(propsPath);
	const outputDir = values.get('out-dir') ?? env.RENDER_OUT_DIR ?? 'pages';

	await renderCards(renderConfigSchema.parse({
		compositionIds,
		formats,
		entryPoint:
			values.get('entry-point') ?? env.RENDER_ENTRY_POINT ?? 'src/app.tsx',
		outputDir,
		props,
		concurrency,
		remotionConcurrency,
		frameRange,
		stillFrame,
		scale: integer(values.get('scale') ?? env.RENDER_SCALE, 'scale'),
		playback: values.get('playback') ?? env.RENDER_PLAYBACK,
		browserExecutable:
			values.get('browser-executable') ?? env.RENDER_BROWSER_EXECUTABLE,
		ffmpegExecutable:
			values.get('ffmpeg-executable') ?? env.RENDER_FFMPEG_EXECUTABLE,
	}));
	console.log(
		`Rendered ${compositionIds.length} cards (${formats.join(', ')}) to ${outputDir}`,
	);
}

export async function runPrepareStatsCli(
	argv: string[] = process.argv.slice(2),
	env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
	const sourceFlags = ['stats-url', 'stats-file', 'username', 'usernames'];
	const {values, help} = parseFlags(argv, [
		...sourceFlags,
		'out',
		'allow-private-repository-details',
	]);
	if (help) {
		console.log(prepareHelp);
		return;
	}
	const cliSource = sourceFlags.some((key) => values.has(key));
	const sourceEnvironment: NodeJS.ProcessEnv = cliSource ? {} : env;
	const statsUrl = values.get('stats-url') ?? sourceEnvironment.STATS_JSON_URL;
	const statsFile =
    values.get('stats-file') ?? sourceEnvironment.STATS_JSON_FILE ?? sourceEnvironment.STATS_JSON_PATH;
	const username = values.get('username') ?? sourceEnvironment.STATS_USERNAME;
	const usernames =
		values.get('usernames') ?? sourceEnvironment.STATS_USERNAMES;
	const allowPrivate =
		values.get('allow-private-repository-details') ??
		env.ALLOW_PRIVATE_REPOSITORY_DETAILS;
	const outputPath =
		values.get('out') ?? env.RENDER_INPUT_PATH ?? 'input.generated.json';
	const props: Record<string, unknown> = {};
	if (statsUrl !== undefined) props.statsUrl = statsUrl;
	if (username !== undefined) props.username = username;
	if (usernames !== undefined)
		props.usernames = parseList(usernames, 'usernames');
	if (allowPrivate !== undefined) {
		if (allowPrivate !== 'true' && allowPrivate !== 'false') {
			throw new Error(
				'allow-private-repository-details must be exactly true or false',
			);
		}
		props.allowPrivateRepositoryDetails = allowPrivate === 'true';
	}
	if (statsFile !== undefined) {
		if (
			resolvePath(statsFile, 'stats-file') === resolvePath(outputPath, 'out')
		) {
			throw new Error(
				'Prepared props must not overwrite the source stats file',
			);
		}
		props.stats = await readJson(statsFile);
	}
	await prepareStats({props, outputPath});
	console.log(`Prepared Remotion input at ${outputPath}`);
}

function parseFlags(argv: string[], names: string[]) {
	const options: ParseArgsConfig['options'] = Object.fromEntries(
		names.map((name) => [name, {type: 'string' as const}]),
	);
	options.help = {type: 'boolean', short: 'h'};
	const parsed = parseArgs({
		args: argv,
		options,
		strict: true,
		allowPositionals: false,
		tokens: true,
	});
	const values = new Map<string, string>();
	const seen = new Set<string>();
	for (const token of parsed.tokens) {
		if (token.kind !== 'option') continue;
		if (seen.has(token.name))
			throw new Error(`Duplicate option: --${token.name}`);
		seen.add(token.name);
		if (token.name === 'help') continue;
		if (token.value === undefined || token.value.trim() === '') {
			throw new Error(`--${token.name} requires a non-empty value`);
		}
		values.set(token.name, token.value);
	}
	return {values, help: parsed.values.help === true};
}

function parseList(value: string, name: string): string[] {
	const entries = value.split(',').map((entry) => entry.trim());
	if (entries.some((entry) => entry === '')) {
		throw new Error(
			`${name} requires a non-empty comma-separated list without empty entries`,
		);
	}
	return entries;
}

function integer(value: string | undefined, name: string): number | undefined {
	if (value === undefined) return undefined;
	if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
		throw new Error(`${name} must be an integer, not ${JSON.stringify(value)}`);
	}
	return Number(value);
}

function parseFrames(value: string): [number, number] {
	const frames = parseList(value, 'frames');
	if (frames.length !== 2)
		throw new Error('frames must be START,END (inclusive)');
	return [integer(frames[0], 'frames')!, integer(frames[1], 'frames')!];
}

async function defaultPropsPath() {
	for (const path of ['input.generated.json', 'input.json']) {
		if (await fileInfo(path)) return path;
	}
	throw new Error(
		'No props file found. Supply --props FILE or run prepare-stats with a real source.',
	);
}

async function readJson(path: string): Promise<unknown> {
	const file = await inputFile(path, 'JSON input');
	try {
		return JSON.parse(await readFile(file, 'utf8')) as unknown;
	} catch (error) {
		if (error instanceof SyntaxError)
			throw new Error(`Invalid JSON in ${file}: ${error.message}`);
		throw error;
	}
}
