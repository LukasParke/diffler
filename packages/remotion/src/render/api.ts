import {copyFile, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {bundle} from '@remotion/bundler';
import {cardDefinitions} from '@lukasparke/diffler-schemas';
import {
	openBrowser,
	renderFrames,
	renderStill,
	selectComposition,
} from '@remotion/renderer';
import type {RenderConfig} from './config';
import {encodeAnimation, type FrameSequence} from './encode';
import {resolveRenderProps} from './input';
import {buildIndexHtml} from './preview';
import {publishFiles} from './publish';
import {validateRenderConfig, type ValidatedRenderConfig} from './validation';

type Browser = Awaited<ReturnType<typeof openBrowser>>;
type RenderJob = {
	config: ValidatedRenderConfig;
	serveUrl: string;
	inputProps: Record<string, unknown>;
	workDir: string;
	generatedDir: string;
};

export async function renderCards(value: RenderConfig): Promise<void> {
	const config = await validateRenderConfig(value);
	const inputProps = await resolveRenderProps(config.props);
	const workDir = await mkdtemp(join(tmpdir(), 'diffler-render-'));

	try {
		const generatedDir = join(workDir, 'outputs');
		await mkdir(generatedDir);
		const serveUrl = await bundle({
			entryPoint: config.entryPoint,
			outDir: join(workDir, 'bundle'),
			enableCaching: false,
			webpackOverride: config.webpackOverride,
		});
		await renderWithBrowsers({
			config,
			serveUrl,
			inputProps,
			workDir,
			generatedDir,
		});

		const files = config.compositionIds.flatMap((id) =>
			config.formats.map((format) => ({
				name: `${id}.${format}`,
				path: join(generatedDir, `${id}.${format}`),
			})),
		);
		const indexPath = join(generatedDir, 'index.html');
		await writeFile(
			indexPath,
			buildIndexHtml(config.compositionIds, config.formats),
			'utf8',
		);
		files.push({name: 'index.html', path: indexPath});
		await publishFiles(config.outputDir, files);
	} finally {
		// Only this invocation's mkdtemp directory is ever removed recursively.
		// Props travel in memory; there is no temporary props file to leak.
		await rm(workDir, {recursive: true, force: true});
	}
}

async function renderWithBrowsers(job: RenderJob): Promise<void> {
	let next = 0;
	let stopped = false;
	const errors: unknown[] = [];
	const workers = Math.min(
		job.config.concurrency,
		job.config.compositionIds.length,
	);

	await Promise.all(
		Array.from({length: workers}, async () => {
			let browser: Browser | undefined;
			try {
				browser = await openBrowser('chrome', {
					browserExecutable: job.config.browserExecutable,
					logLevel: 'error',
				});
				// A browser is reused serially within a worker, never shared by competing
				// renderFrames calls that could interfere with one another's tabs.
				while (next < job.config.compositionIds.length) {
					if (stopped) break;
					const id = job.config.compositionIds[next++];
					await renderCard(job, id, browser);
				}
			} catch (error) {
				stopped = true;
				errors.push(error);
			} finally {
				if (browser) {
					await browser.close({silent: true}).catch((error) => {
						stopped = true;
						errors.push(error);
					});
				}
			}
		}),
	);
	// Wait for every in-flight worker and encoder before removing its files.
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1)
		throw new AggregateError(errors, 'Card rendering failed');
}

async function renderCard(
	job: RenderJob,
	id: string,
	browser: Browser,
): Promise<void> {
	const {config, inputProps, serveUrl, generatedDir} = job;
	const playback = config.playback ?? cardDefinitions.find((card) => card.id === id)?.playback ?? 'once';
	const shared = {
		serveUrl,
		inputProps,
		puppeteerInstance: browser,
		browserExecutable: config.browserExecutable,
		logLevel: 'error' as const,
	};
	const composition = await selectComposition({...shared, id});
	if (
		composition.id !== id ||
		!Number.isSafeInteger(composition.durationInFrames) ||
		composition.durationInFrames < 1 ||
		!Number.isFinite(composition.fps) ||
		composition.fps <= 0
	) {
		throw new Error(`Invalid composition metadata for ${id}`);
	}
	const [start, end] = config.frameRange ?? [
		0,
		composition.durationInFrames - 1,
	];
	const stillFrame = config.stillFrame ?? composition.durationInFrames - 1;
	if (
		end >= composition.durationInFrames ||
		stillFrame >= composition.durationInFrames
	) {
		throw new Error(
			`Requested frame is outside ${id}'s ${composition.durationInFrames} frames`,
		);
	}

	let frames: FrameSequence | undefined;
	const framesDir = join(job.workDir, `frames-${id}`);
	const animations = config.formats.filter((format) => format !== 'png');
	if (animations.length > 0) {
		await mkdir(framesDir);
		const result = await renderFrames({
			...shared,
			composition,
			outputDir: framesDir,
			frameRange: [start, end],
			concurrency: config.remotionConcurrency,
			imageFormat: 'png',
			scale: config.scale,
			everyNthFrame: 1,
			muted: true,
			onStart: () => undefined,
			onFrameUpdate: () => undefined,
		});
		if (result.frameCount !== end - start + 1) {
			throw new Error(
				`Incomplete frame render for ${id}: expected ${end - start + 1}, got ${result.frameCount}`,
			);
		}
		frames = {
			pattern: result.assetsInfo.imageSequenceName,
			firstFrame: result.assetsInfo.firstFrameIndex,
			frameCount: result.frameCount,
			fps: composition.fps,
		};
		for (const format of animations) {
			await encodeAnimation(
				config.ffmpegExecutable,
				format,
				frames,
				join(generatedDir, `${id}.${format}`),
				playback,
			);
		}
	}

	if (config.formats.includes('png')) {
		const output = join(generatedDir, `${id}.png`);
		if (frames && stillFrame >= start && stillFrame <= end) {
			const index = frames.firstFrame + stillFrame - start;
			const source = frames.pattern.replace(/%0?(\d*)d/, (_, padding: string) =>
				String(index).padStart(Number(padding), '0'),
			);
			await copyFile(source, output);
		} else {
			await renderStill({
				...shared,
				composition,
				output,
				frame: stillFrame,
				imageFormat: 'png',
				scale: config.scale,
				overwrite: false,
			});
		}
	}
	if (frames) {
		// Finished card frames need not accumulate while later cards render. On
		// failure the job-level cleanup waits for browsers/workers before removal.
		await rm(framesDir, {recursive: true, force: true});
	}
}
