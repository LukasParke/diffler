import {existsSync} from 'node:fs';
import {
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rename,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, extname, isAbsolute, join} from 'node:path';
import {PassThrough} from 'node:stream';
import {ChildProcess, spawn} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {
	openBrowser,
	renderFrames,
	renderStill,
	selectComposition,
} from '@remotion/renderer';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cards} from '../cards';
import {defaultStats} from '../data/defaultStats';
import {renderCards} from './api';
import {runPrepareStatsCli, runRenderCli} from './commands';
import {prepareStats} from './prepare';
import type {RenderConfig} from './config';

vi.mock('@remotion/bundler', () => ({bundle: vi.fn()}));
vi.mock('@remotion/renderer', () => ({
	openBrowser: vi.fn(),
	selectComposition: vi.fn(),
	renderFrames: vi.fn(),
	renderStill: vi.fn(),
}));
vi.mock('node:child_process', async (importActual) => ({
	...await importActual<typeof import('node:child_process')>(),
	spawn: vi.fn(),
}));
vi.mock('node:fs/promises', async (importActual) => {
	const actual = await importActual<typeof import('node:fs/promises')>();
	return {...actual, rename: vi.fn(actual.rename)};
});

type Browser = Awaited<ReturnType<typeof openBrowser>>;
let directory: string;
let config: RenderConfig;
let propsPath: string;
let browsers: Array<{close: ReturnType<typeof vi.fn<Browser['close']>>}>;
const legacyStats = {
	username: 'test-user',
	name: 'Source Person',
	fetchedAt: 1_700_000_000_000,
	totalContributions: 42,
	totalCommits: 7,
};

beforeEach(async () => {
	vi.clearAllMocks();
	directory = await mkdtemp(join(tmpdir(), 'diffler-render-test-'));
	const entryPoint = join(directory, 'app.tsx');
	await writeFile(entryPoint, '// Test entry point');
	propsPath = join(directory, 'props.json');
	config = {
		compositionIds: ['stats'],
		entryPoint,
		formats: ['webp'],
		outputDir: join(directory, 'output'),
		props: {
			userStats: {
				...structuredClone(defaultStats),
				name: 'Test Person',
				username: 'test-user',
				avatarUrl: '',
			},
		},
	};
	await writeFile(propsPath, JSON.stringify(config.props));
	browsers = [];
	vi.mocked(bundle).mockImplementation(async (...args) => {
		const outDir = bundleOutput(args);
		await mkdir(outDir, {recursive: true});
		await writeFile(join(outDir, 'index.html'), 'bundle');
		return outDir;
	});
	vi.mocked(openBrowser, {partial: true}).mockImplementation(async () => {
		const browser = {
			close: vi.fn<Browser['close']>().mockResolvedValue(undefined),
		};
		browsers.push(browser);
		return browser;
	});
	vi.mocked(selectComposition, {partial: true}).mockImplementation(async ({id, inputProps}) => ({
		id,
		width: 500,
		height: 280,
		fps: 24,
		durationInFrames: 3,
		props: inputProps ?? {},
		defaultProps: {},
		defaultCodec: null,
	}));
	vi.mocked(renderFrames, {partial: true, deep: true}).mockImplementation(writeFrames);
	vi.mocked(renderStill).mockImplementation(async ({output, frame}) => {
		await writeFile(output!, `still ${frame}`);
		return {buffer: null, contentType: 'image/png'};
	});
	vi.mocked(spawn).mockImplementation(fakeEncoder);
	vi.mocked(rename).mockImplementation(
		(
			await vi.importActual<typeof import('node:fs/promises')>(
				'node:fs/promises',
			)
		).rename,
	);
	vi.stubGlobal(
		'fetch',
		vi.fn().mockRejectedValue(new Error('Unexpected network request')),
	);
	vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	await rm(directory, {recursive: true, force: true});
});

async function writeFrames(options: Parameters<typeof renderFrames>[0]) {
	if (!Array.isArray(options.frameRange)) throw new Error('Expected an explicit frame range');
	const [start, end] = options.frameRange;
	if (typeof start !== 'number' || typeof end !== 'number') throw new Error('Expected a numeric frame range');
	await mkdir(options.outputDir!, {recursive: true});
	for (let frame = start; frame <= end; frame++) {
		await writeFile(
			join(options.outputDir!, `element-${String(frame).padStart(3, '0')}.png`),
			`frame ${frame}`,
		);
	}
	return {
		frameCount: end - start + 1,
		assetsInfo: {
			imageSequenceName: join(options.outputDir!, 'element-%03d.png'),
			firstFrameIndex: start,
			assets: [],
		},
	};
}

function fakeEncoder(_command: string, args?: readonly string[] | object) {
	const child = new ChildProcess();
	child.stderr = new PassThrough();
	queueMicrotask(async () => {
		try {
			const output = encoderArguments(args).at(-1);
			if (!output || !isAbsolute(output))
				throw new Error('Encoder output must be an absolute staged path');
			await writeFile(output, `encoded ${extname(output)}`);
			child.emit('close', 0, null);
		} catch (error) {
			child.emit('error', error);
			child.emit('close', 1, null);
		}
	});
	return child;
}

function failingEncoder() {
	const child = new ChildProcess();
	const stderr = new PassThrough();
	child.stderr = stderr;
	queueMicrotask(() => {
		stderr.write('encoder exploded');
		child.emit('close', 1, null);
	});
	return child;
}

function bundleOutput(args: Parameters<typeof bundle>) {
	const options = typeof args[0] === 'string' ? args[2] : args[0];
	if (!options?.outDir) throw new Error('Expected an explicit bundle output directory');
	return options.outDir;
}

function encoderArguments(args: readonly string[] | object | undefined): readonly string[] {
	if (!Array.isArray(args) || args.some((arg: unknown) => typeof arg !== 'string')) {
		throw new Error('Expected string encoder arguments');
	}
	return args;
}

function workDir() {
	return dirname(bundleOutput(vi.mocked(bundle).mock.calls[0]));
}

async function seedDestination() {
	await mkdir(config.outputDir);
	await writeFile(join(config.outputDir, 'stats.webp'), 'previous WebP');
	await writeFile(join(config.outputDir, 'index.html'), 'previous index');
	await writeFile(join(config.outputDir, 'keep.txt'), 'unrelated');
}

async function expectUnchangedDestination() {
	expect(await readFile(join(config.outputDir, 'stats.webp'), 'utf8')).toBe(
		'previous WebP',
	);
	expect(await readFile(join(config.outputDir, 'index.html'), 'utf8')).toBe(
		'previous index',
	);
	expect(await readFile(join(config.outputDir, 'keep.txt'), 'utf8')).toBe(
		'unrelated',
	);
	expect(await readdir(config.outputDir)).toEqual([
		'index.html',
		'keep.txt',
		'stats.webp',
	]);
}

function cliArgs(...extra: string[]) {
	return [
		'--props',
		propsPath,
		'--entry-point',
		config.entryPoint,
		'--out-dir',
		config.outputDir,
		...extra,
	];
}

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((res) => {
		resolve = res;
	});
	return {promise, resolve};
}

describe('renderCards output', () => {
	it('publishes a subset without deleting other cards, formats or user temporary directories', async () => {
		await seedDestination();
		await writeFile(
			join(config.outputDir, 'main-stats.gif'),
			'previous other card',
		);
		await writeFile(
			join(config.outputDir, 'stats.gif'),
			'previous other format',
		);
		await mkdir(join(config.outputDir, '.tmp'));
		await writeFile(
			join(config.outputDir, '.tmp', 'user-file'),
			'not our temporary file',
		);

		await renderCards(config);

		expect(await readFile(join(config.outputDir, 'stats.webp'), 'utf8')).toBe(
			'encoded .webp',
		);
		expect(
			await readFile(join(config.outputDir, 'main-stats.gif'), 'utf8'),
		).toBe('previous other card');
		expect(await readFile(join(config.outputDir, 'stats.gif'), 'utf8')).toBe(
			'previous other format',
		);
		expect(await readFile(join(config.outputDir, 'keep.txt'), 'utf8')).toBe(
			'unrelated',
		);
		expect(
			await readFile(join(config.outputDir, '.tmp', 'user-file'), 'utf8'),
		).toBe('not our temporary file');
		expect(await readdir(config.outputDir)).toEqual([
			'.tmp',
			'index.html',
			'keep.txt',
			'main-stats.gif',
			'stats.gif',
			'stats.webp',
		]);
		expect(
			await readFile(join(config.outputDir, 'index.html'), 'utf8'),
		).toContain('./stats.webp');
		expect(existsSync(workDir())).toBe(false);
	});

	it('renders lossless frames once and independently feeds WebP and palette GIF encoders', async () => {
		await renderCards({
			...config,
			formats: ['webp', 'gif', 'png'],
			frameRange: [1, 2],
		});

		expect(renderFrames).toHaveBeenCalledTimes(1);
		expect(renderFrames).toHaveBeenCalledWith(
			expect.objectContaining({
				imageFormat: 'png',
				scale: 2,
				frameRange: [1, 2],
				everyNthFrame: 1,
				concurrency: 1,
			}),
		);
		const commands = vi.mocked(spawn).mock.calls;
		expect(commands).toHaveLength(2);
		const webp = encoderArguments(commands[0][1]);
		const gif = encoderArguments(commands[1][1]);
		const source = webp[webp.indexOf('-i') + 1];
		expect(source).toMatch(/element-%03d\.png$/);
		expect(gif[gif.indexOf('-i') + 1]).toBe(source);
		expect(webp).toContain('libwebp_anim');
		expect(webp[webp.indexOf('-loop') + 1]).toBe('1');
		expect(gif[gif.indexOf('-loop') + 1]).toBe('-1');
		expect(gif[gif.indexOf('-filter_complex') + 1]).toMatch(
			/palettegen=.*paletteuse=/,
		);
		for (const [command, args, options] of commands) {
			expect(command).toBe('ffmpeg');
			expect(options).toMatchObject({shell: false});
			const flags = encoderArguments(args);
			expect(flags[flags.indexOf('-framerate') + 1]).toBe('24');
			expect(flags[flags.indexOf('-start_number') + 1]).toBe('1');
			expect(flags[flags.indexOf('-frames:v') + 1]).toBe('2');
		}
		expect(await readFile(join(config.outputDir, 'stats.png'), 'utf8')).toBe(
			'frame 2',
		);
		expect(renderStill).not.toHaveBeenCalled();
		expect(await readdir(config.outputDir)).toEqual([
			'index.html',
			'stats.gif',
			'stats.png',
			'stats.webp',
		]);
	});

	it('renders just the settled frame for PNG-only output without requiring FFmpeg', async () => {
		await renderCards({...config, formats: ['png']});
		expect(renderStill).toHaveBeenCalledWith(
			expect.objectContaining({frame: 2, imageFormat: 'png', scale: 2}),
		);
		expect(await readFile(join(config.outputDir, 'stats.png'), 'utf8')).toBe(
			'still 2',
		);
		expect(renderFrames).not.toHaveBeenCalled();
		expect(spawn).not.toHaveBeenCalled();
	});

	it.each(['readme', 'readme-spotlight'])('encodes %s with its default looping playback', async (id) => {
		await renderCards({...config, compositionIds: [id], formats: ['webp', 'gif']});
		for (const [, args] of vi.mocked(spawn).mock.calls) {
			const flags = encoderArguments(args);
			expect(flags[flags.indexOf('-loop') + 1]).toBe('0');
		}
	});

	it('supports explicit PNG baseline frames, including one outside the animation range', async () => {
		await renderCards({
			...config,
			formats: ['webp', 'png'],
			frameRange: [0, 0],
			stillFrame: 1,
		});
		expect(renderStill).toHaveBeenCalledWith(
			expect.objectContaining({frame: 1}),
		);
		expect(await readFile(join(config.outputDir, 'stats.png'), 'utf8')).toBe(
			'still 1',
		);
	});

	it('bundles once and reuses a worker browser across cards with explicit frame concurrency', async () => {
		const browserExecutable = join(directory, 'chrome');
		await writeFile(browserExecutable, 'test browser');
		await chmod(browserExecutable, 0o700);
		await renderCards({
			...config,
			compositionIds: ['stats', 'languages', 'main-stats'],
			remotionConcurrency: 2,
			browserExecutable,
		});
		expect(bundle).toHaveBeenCalledTimes(1);
		expect(openBrowser).toHaveBeenCalledTimes(1);
		expect(openBrowser).toHaveBeenCalledWith(
			'chrome',
			expect.objectContaining({browserExecutable}),
		);
		for (const [options] of vi.mocked(renderFrames).mock.calls) {
			expect(options.puppeteerInstance).toBe(browsers[0]);
			expect(options.concurrency).toBe(2);
		}
		expect(browsers[0].close).toHaveBeenCalledWith({silent: true});
		expect(fetch).not.toHaveBeenCalled();
	});

	it('loads a real source once and supplies only normalized data to each composition', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(legacyStats)),
		);
		await renderCards({
			...config,
			compositionIds: ['stats', 'languages'],
			props: {statsUrl: 'https://example.test/stats.json', accent: 'blue'},
		});
		expect(fetch).toHaveBeenCalledTimes(1);
		for (const [{inputProps}] of vi.mocked(selectComposition).mock.calls) {
			expect(inputProps).toMatchObject({
				userStats: {username: 'test-user', name: 'Source Person'},
				accent: 'blue',
			});
			expect(inputProps).not.toHaveProperty('statsUrl');
			expect(inputProps).not.toHaveProperty('stats');
		}
	});
});

describe('failure safety', () => {
	it.each([
		'bundle',
		'browser',
		'metadata',
		'frames',
		'encoding',
		'browser cleanup',
	])(
		'preserves previous assets and cleans owned work when %s fails',
		async (step) => {
			await seedDestination();
			const failure = new Error(`${step} failed`);
			if (step === 'bundle') vi.mocked(bundle).mockRejectedValueOnce(failure);
			if (step === 'browser')
				vi.mocked(openBrowser).mockRejectedValueOnce(failure);
			if (step === 'metadata')
				vi.mocked(selectComposition).mockRejectedValueOnce(failure);
			if (step === 'frames')
				vi.mocked(renderFrames).mockRejectedValueOnce(failure);
			if (step === 'encoding')
				vi.mocked(spawn).mockImplementationOnce(failingEncoder);
		if (step === 'browser cleanup') {
				vi.mocked(openBrowser, {partial: true}).mockImplementationOnce(async () => {
					const browser = {
						close: vi.fn<Browser['close']>().mockRejectedValueOnce(failure),
					};
					browsers.push(browser);
					return browser;
				});
			}
			await expect(renderCards(config)).rejects.toThrow(
				step === 'encoding' ? /encoder exploded/ : failure.message,
			);
			await expectUnchangedDestination();
			for (const browser of browsers)
				expect(browser.close).toHaveBeenCalledTimes(1);
			expect(existsSync(workDir())).toBe(false);
		},
	);

	it('does not publish a successful WebP if a later GIF encode fails', async () => {
		await seedDestination();
		vi.mocked(spawn)
			.mockImplementationOnce(fakeEncoder)
			.mockImplementationOnce(failingEncoder);
		await expect(
			renderCards({...config, formats: ['webp', 'gif']}),
		).rejects.toThrow(/FFmpeg/);
		await expectUnchangedDestination();
		expect(existsSync(workDir())).toBe(false);
	});

	it('cleans still-render failures without publishing a blank PNG', async () => {
		await seedDestination();
		vi.mocked(renderStill).mockRejectedValueOnce(new Error('still failed'));
		await expect(renderCards({...config, formats: ['png']})).rejects.toThrow(
			'still failed',
		);
		await expectUnchangedDestination();
		expect(browsers[0].close).toHaveBeenCalledTimes(1);
		expect(existsSync(workDir())).toBe(false);
	});

	it('rejects incomplete frame sequences instead of a successful empty render', async () => {
		await seedDestination();
		vi.mocked(renderFrames, {partial: true}).mockResolvedValueOnce({frameCount: 0});
		await expect(renderCards(config)).rejects.toThrow(/Incomplete frame/);
		await expectUnchangedDestination();
		expect(spawn).not.toHaveBeenCalled();
		expect(existsSync(workDir())).toBe(false);
	});

	it('does not trust an encoder exit code when the output was never written', async () => {
		await seedDestination();
		vi.mocked(spawn).mockImplementationOnce(() => {
			const child = new ChildProcess();
			queueMicrotask(() => child.emit('close', 0, null));
			return child;
		});
		await expect(renderCards(config)).rejects.toThrow(/non-empty output/);
		await expectUnchangedDestination();
		expect(existsSync(workDir())).toBe(false);
	});

	it('rolls back replacements and removes new files if publishing a later file fails', async () => {
		await seedDestination();
		const realRename = (
			await vi.importActual<typeof import('node:fs/promises')>(
				'node:fs/promises',
			)
		).rename;
		vi.mocked(rename).mockImplementation(async (from, to) => {
			if (
				String(from).includes('new-') &&
				to === join(config.outputDir, 'index.html')
			) {
				throw new Error('publication failed');
			}
			await realRename(from, to);
		});
		await expect(
			renderCards({...config, formats: ['webp', 'gif']}),
		).rejects.toThrow('publication failed');
		await expectUnchangedDestination();
		expect(existsSync(workDir())).toBe(false);
	});

	it('waits for in-flight workers on failure and never starts queued cards', async () => {
		await seedDestination();
		const secondStarted = deferred();
		const releaseSecond = deferred();
		const firstClosed = deferred();
		vi.mocked(openBrowser, {partial: true}).mockImplementation(async () => {
			const browser = {
				close: vi
					.fn<Browser['close']>()
					.mockImplementation(async () => firstClosed.resolve()),
			};
			browsers.push(browser);
			return browser;
		});
		vi.mocked(renderFrames, {partial: true, deep: true}).mockImplementation(async (options) => {
			if (options.composition.id === 'stats') {
				await secondStarted.promise;
				throw new Error('first worker failed');
			}
			secondStarted.resolve();
			await releaseSecond.promise;
			return writeFrames(options);
		});
		let settled = false;
		const rendering = renderCards({
			...config,
			compositionIds: ['stats', 'languages', 'main-stats'],
			concurrency: 2,
		});
		const result = rendering
			.catch((error: unknown) => error)
			.finally(() => {
				settled = true;
			});
		await firstClosed.promise;
		expect(settled).toBe(false);
		expect(existsSync(workDir())).toBe(true);
		expect(renderFrames).toHaveBeenCalledTimes(2);
		releaseSecond.resolve();
		expect(await result).toMatchObject({message: 'first worker failed'});
		expect(browsers).toHaveLength(2);
		for (const browser of browsers)
			expect(browser.close).toHaveBeenCalledTimes(1);
		expect(renderFrames).toHaveBeenCalledTimes(2);
		await expectUnchangedDestination();
		expect(existsSync(workDir())).toBe(false);
	});
});

describe('renderCards boundary', () => {
	it.each([
		{compositionIds: ['not-a-card']},
		{compositionIds: ['../stats']},
		{compositionIds: []},
		{compositionIds: ['stats', 'stats']},
		{formats: []},
		{formats: ['avif']},
		{formats: ['gif', 'gif']},
		{concurrency: 0},
		{concurrency: -1},
		{concurrency: 1.5},
		{concurrency: 9},
		{concurrency: Number.NaN},
		{remotionConcurrency: 0},
		{remotionConcurrency: 17},
		{concurrency: 8, remotionConcurrency: 8},
		{props: {}},
		{props: null},
		{props: []},
		{props: {userStats: {}}},
		{props: {statsUrl: 'file:///private/stats.json'}},
		{props: {username: '../user'}},
		{frameRange: [2, 1]},
		{frameRange: [-1, 2]},
		{stillFrame: -1, formats: ['png']},
		{stillFrame: 0},
		{scale: 0},
		{scale: 1.5},
		{scale: 5},
		{playback: 'forever'},
		{frameRange: [0, 1], formats: ['png']},
		{outputDir: ''},
		{outputDir: '/'},
		{browserExecutable: ''},
		{ffmpegExecutable: '-not-an-executable'},
		{unknownOption: true},
	])(
		'rejects invalid configuration before external work: %j',
		async (invalid) => {
			await expect(
				// @ts-expect-error Exercise runtime validation of untyped consumer input.
				renderCards({...config, ...invalid}),
			).rejects.toThrow();
			expect(bundle).not.toHaveBeenCalled();
			expect(openBrowser).not.toHaveBeenCalled();
			expect(spawn).not.toHaveBeenCalled();
			expect(fetch).not.toHaveBeenCalled();
			expect(existsSync(config.outputDir)).toBe(false);
		},
	);

	it('rejects non-JSON and circular props without leaking temporary files', async () => {
		const circular: Record<string, unknown> = {...config.props};
		circular.self = circular;
		for (const props of [
			circular,
			{...config.props, bad: () => 1},
			{...config.props, bad: Infinity},
		]) {
			await expect(renderCards({...config, props})).rejects.toThrow(
				/JSON|circular/,
			);
		}
		expect(bundle).not.toHaveBeenCalled();
	});

	it('rejects missing entry points, executable paths and output directories that are files', async () => {
		for (const invalid of [
			{entryPoint: join(directory, 'missing.tsx')},
			{browserExecutable: join(directory, 'missing-browser')},
			{ffmpegExecutable: join(directory, 'missing-ffmpeg')},
			{outputDir: config.entryPoint},
		]) {
			await expect(renderCards({...config, ...invalid})).rejects.toThrow(
				/file|exist|directory/,
			);
		}
		expect(bundle).not.toHaveBeenCalled();
	});

	it('refuses symlink destinations rather than overwriting their targets', async () => {
		await seedDestination();
		const privatePath = join(directory, 'not-an-asset');
		await writeFile(privatePath, 'private file');
		await rm(join(config.outputDir, 'stats.webp'));
		await symlink(privatePath, join(config.outputDir, 'stats.webp'));
		await expect(renderCards(config)).rejects.toThrow(/symlink/);
		expect(await readFile(privatePath, 'utf8')).toBe('private file');
		expect(bundle).not.toHaveBeenCalled();
	});

	it('refuses directory destinations that are symlinks', async () => {
		const link = join(directory, 'linked-output');
		await symlink(directory, link);
		await expect(renderCards({...config, outputDir: link})).rejects.toThrow(
			/symlink/,
		);
		expect(bundle).not.toHaveBeenCalled();
	});

	it('rejects out-of-bounds frames after reading metadata, before rendering', async () => {
		await expect(renderCards({...config, frameRange: [0, 3]})).rejects.toThrow(
			/outside/,
		);
		expect(renderFrames).not.toHaveBeenCalled();
		expect(browsers[0].close).toHaveBeenCalledTimes(1);
		expect(existsSync(workDir())).toBe(false);
	});
});

describe('render CLI delegation', () => {
	it('honors explicit scale and playback for animation frames and a separate PNG poster', async () => {
		await runRenderCli(cliArgs(
			'--cards=readme',
			'--formats=webp,gif,png',
			'--frames=0,1',
			'--still-frame=2',
			'--scale=1',
			'--playback=once',
		), {});
		expect(renderFrames).toHaveBeenCalledWith(expect.objectContaining({scale: 1, frameRange: [0, 1]}));
		expect(renderStill).toHaveBeenCalledWith(expect.objectContaining({scale: 1, frame: 2}));
		const commands = vi.mocked(spawn).mock.calls;
		const webp = encoderArguments(commands[0][1]);
		const gif = encoderArguments(commands[1][1]);
		expect(webp[webp.indexOf('-loop') + 1]).toBe('1');
		expect(gif[gif.indexOf('-loop') + 1]).toBe('-1');
	});

	it('supports both flag forms and delegates to the real pipeline for a subset', async () => {
		await runRenderCli(
			cliArgs(
				'--cards=stats,languages',
				'--formats',
				'png',
				'--still-frame=0',
				'--card-concurrency',
				'1',
			),
			{},
		);
		expect(await readdir(config.outputDir)).toEqual([
			'index.html',
			'languages.png',
			'stats.png',
		]);
		expect(await readFile(join(config.outputDir, 'stats.png'), 'utf8')).toBe(
			'still 0',
		);
		expect(bundle).toHaveBeenCalledTimes(1);
	});

	it('uses the card registry by default rather than a second hardcoded list', async () => {
		await runRenderCli(cliArgs('--formats=png'), {});
		const filenames = await readdir(config.outputDir);
		expect(filenames).toHaveLength(cards.length + 1);
		for (const {id} of cards) expect(filenames).toContain(`${id}.png`);
	});

	it.each(
		[
			['--bogus=true'],
			['extra-positional'],
			['--cards='],
			['--formats=webp,'],
			['--formats=mp4'],
			['--cards=unknown'],
			['--concurrency=zero'],
			['--concurrency=0'],
			['--concurrency=1.5'],
			['--remotion-concurrency=-1'],
			['--frames=0'],
			['--cards=stats', '--cards=languages'],
			['--concurrency=1', '--card-concurrency=2'],
			['--out-dir'],
		].map((args) => ({args})),
	)('rejects invalid flags without rendering: $args', async ({args}) => {
		await expect(runRenderCli(cliArgs(...args), {})).rejects.toThrow();
		expect(bundle).not.toHaveBeenCalled();
		expect(spawn).not.toHaveBeenCalled();
	});

	it('rejects invalid environment defaults rather than silently using concurrency one', async () => {
		await expect(
			runRenderCli(cliArgs('--cards=stats'), {RENDER_CARD_CONCURRENCY: '0'}),
		).rejects.toThrow();
		expect(bundle).not.toHaveBeenCalled();
	});

	it('shows help without requiring props or starting a render', async () => {
		await runRenderCli(['--help'], {});
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining('Usage: github-readme-cards'),
		);
		expect(bundle).not.toHaveBeenCalled();
	});
});

describe('prepare-stats shared data boundary', () => {
	it('requires an actual source instead of fetching stats-user', async () => {
		await expect(
			runPrepareStatsCli(['--out', join(directory, 'input.json')], {}),
		).rejects.toThrow(/Provide/);
		expect(fetch).not.toHaveBeenCalled();
		expect(existsSync(join(directory, 'input.json'))).toBe(false);
	});

	it('writes validated normalized props from the configured URL without a future refetch', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(legacyStats)),
		);
		const outputPath = join(directory, 'input.generated.json');
		await runPrepareStatsCli([], {
			STATS_JSON_URL: 'https://example.test/stats.json',
			RENDER_INPUT_PATH: outputPath,
		});
		const prepared = JSON.parse(await readFile(outputPath, 'utf8'));
		expect(prepared).toMatchObject({
			userStats: {
				username: 'test-user',
				name: 'Source Person',
				totalCommits: 7,
			},
		});
		expect(prepared).not.toHaveProperty('statsUrl');
		expect(prepared).not.toHaveProperty('stats');
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(bundle).not.toHaveBeenCalled();
		expect(await readdir(directory)).toEqual([
			'app.tsx',
			'input.generated.json',
			'props.json',
		]);
	});

	it('gives an explicit local source precedence over an environment URL', async () => {
		const statsPath = join(directory, 'raw.json');
		const outputPath = join(directory, 'prepared.json');
		await writeFile(statsPath, JSON.stringify(legacyStats));
		await runPrepareStatsCli(['--stats-file', statsPath, '--out', outputPath], {
			STATS_JSON_URL: 'https://example.test/wrong.json',
		});
		expect(
			JSON.parse(await readFile(outputPath, 'utf8')).userStats.username,
		).toBe('test-user');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('supports the existing STATS_JSON_FILE environment input without fetching', async () => {
		const statsPath = join(directory, 'raw.json');
		const outputPath = join(directory, 'prepared.json');
		await writeFile(statsPath, JSON.stringify(legacyStats));
		await runPrepareStatsCli([], {STATS_JSON_FILE: statsPath, RENDER_INPUT_PATH: outputPath});
		expect(JSON.parse(await readFile(outputPath, 'utf8')).userStats.username).toBe('test-user');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('preserves a previous input on fetch, malformed data and privacy failures', async () => {
		const outputPath = join(directory, 'prepared.json');
		await writeFile(outputPath, 'previous input');
		for (const response of [
			new Response('unavailable', {status: 503}),
			new Response(JSON.stringify({error: 'invalid stats'})),
			new Response(
				JSON.stringify({
					...legacyStats,
					privacy: {
						...defaultStats.privacy,
						privateRepositoryDetailsIncluded: true,
					},
				}),
			),
		]) {
			vi.mocked(fetch).mockResolvedValueOnce(response);
			await expect(
				runPrepareStatsCli(
					['--stats-url=https://example.test/stats.json', '--out', outputPath],
					{},
				),
			).rejects.toThrow();
			expect(await readFile(outputPath, 'utf8')).toBe('previous input');
			expect(await readdir(directory)).toEqual([
				'app.tsx',
				'prepared.json',
				'props.json',
			]);
		}
	});

	it('enforces the same privacy opt-in for already-normalized props', async () => {
		const outputPath = join(directory, 'prepared.json');
		const userStats = {
			...defaultStats,
			privacy: {
				...defaultStats.privacy,
				privateRepositoryDetailsIncluded: true,
			},
		};
		await expect(
			prepareStats({props: {userStats}, outputPath}),
		).rejects.toThrow(/private/i);
		expect(existsSync(outputPath)).toBe(false);
		await prepareStats({
			props: {userStats, allowPrivateRepositoryDetails: true},
			outputPath,
		});
		expect(JSON.parse(await readFile(outputPath, 'utf8'))).toMatchObject({
			allowPrivateRepositoryDetails: true,
			userStats: {privacy: {privateRepositoryDetailsIncluded: true}},
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it('rejects unknown flags and malformed privacy opt-ins', async () => {
		await expect(runPrepareStatsCli(['--unknown=value'], {})).rejects.toThrow();
		await expect(
			runPrepareStatsCli([], {ALLOW_PRIVATE_REPOSITORY_DETAILS: 'yes'}),
		).rejects.toThrow(/true or false/);
		expect(fetch).not.toHaveBeenCalled();
	});
});
