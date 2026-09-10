import {spawn} from 'node:child_process';
import type {CardPlayback} from '@lukasparke/diffler-schemas';
import type {RenderFormat} from './config';

export type FrameSequence = {
	pattern: string;
	firstFrame: number;
	frameCount: number;
	fps: number;
};

export function encodeAnimation(
	executable: string,
	format: Exclude<RenderFormat, 'png'>,
	frames: FrameSequence,
	output: string,
	playback: CardPlayback,
): Promise<void> {
	const encoding =
		format === 'webp'
			? [
					'-c:v',
					'libwebp_anim',
					'-lossless',
					'1',
					'-quality',
					'90',
					'-compression_level',
					'6',
				]
			: [
					'-filter_complex',
					'[0:v]split[colors][pixels];[colors]palettegen=stats_mode=full[palette];[pixels][palette]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
					'-c:v',
					'gif',
				];

	// Both codecs read the original PNG sequence, never another encoded output.
	// Each card worker runs one encoder at a time, with explicitly bounded threads.
	return runFfmpeg(executable, [
		'-hide_banner',
		'-loglevel',
		'error',
		'-nostdin',
		'-y',
		'-threads',
		'1',
		'-filter_threads',
		'1',
		'-filter_complex_threads',
		'1',
		'-framerate',
		String(frames.fps),
		'-start_number',
		String(frames.firstFrame),
		'-i',
		frames.pattern,
		...encoding,
		'-threads',
		'1',
		'-frames:v',
		String(frames.frameCount),
		'-loop',
		playback === 'loop' ? '0' : format === 'gif' ? '-1' : '1',
		'-an',
		'-fps_mode',
		'passthrough',
		output,
	]);
}

function runFfmpeg(executable: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(executable, args, {
			stdio: ['ignore', 'ignore', 'pipe'],
			shell: false,
		});
		let stderr = '';
		child.stderr?.on('data', (chunk: Buffer) => {
			// Keep useful diagnostics without letting a failing encoder exhaust memory.
			stderr = (stderr + chunk.toString()).slice(-16_384);
		});
		child.once('error', (error) => {
			reject(
				new Error(
					`Unable to start FFmpeg (${executable}). Install FFmpeg with libwebp support or set ffmpegExecutable: ${error.message}`,
				),
			);
		});
		// 'close', not 'exit': all child I/O has settled before temporary files go away.
		child.once('close', (code, signal) => {
			if (code === 0) {
				resolve();
			} else {
				reject(
					new Error(
						`FFmpeg failed (${signal ?? `exit ${code}`}): ${stderr.trim()}`,
					),
				);
			}
		});
	});
}
