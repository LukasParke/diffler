import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {GeminiBeams} from './GeminiBeams';

const clock = vi.hoisted(() => ({frame: 0, fps: 30, durationInFrames: 300}));

vi.mock('remotion', async (importOriginal) => ({
	...(await importOriginal<typeof import('remotion')>()),
	useCurrentFrame: () => clock.frame,
	useVideoConfig: () => ({
		fps: clock.fps,
		durationInFrames: clock.durationInFrames,
	}),
}));

function offsets(html: string): number[] {
	return [...html.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((match) =>
		Number(match[1]),
	);
}

beforeEach(() => {
	clock.frame = 0;
	clock.fps = 30;
	clock.durationInFrames = 300;
});

describe('original filament artwork', () => {
	it('preserves the five staggered initial stroke lengths from the March source', () => {
		const html = renderToStaticMarkup(<GeminiBeams mode="draw" />);
		expect(offsets(html)).toEqual([0.8, 0.85, 0.9, 0.95, 1]);
	});

	it('settles all five original strokes for the final hold', () => {
		clock.frame = 250;
		const html = renderToStaticMarkup(<GeminiBeams mode="draw" />);
		expect(offsets(html)).toEqual([0, 0, 0, 0, 0]);
	});

	it('keeps the source reveal duration when a consumer changes FPS', () => {
		clock.frame = 500;
		clock.fps = 60;
		clock.durationInFrames = 600;
		const html = renderToStaticMarkup(<GeminiBeams mode="draw" />);
		expect(offsets(html)).toEqual([0, 0, 0, 0, 0]);
	});

	it('moves each ambient dash by exactly one repeating pattern per composition', () => {
		const first = offsets(renderToStaticMarkup(<GeminiBeams />));
		clock.frame = 300;
		const last = offsets(renderToStaticMarkup(<GeminiBeams />));
		expect(
			last.map(
				(offset, index) => Math.round((offset - first[index]) * 1e10) / 1e10,
			),
		).toEqual([-1, -1, -1, -1, -1]);
	});

	it('does not share filter IDs between two instances in one composition', () => {
		const html = renderToStaticMarkup(
			<>
				<GeminiBeams />
				<GeminiBeams />
			</>,
		);
		const ids = [...html.matchAll(/<filter id="([^"]+)"/g)].map(
			(match) => match[1],
		);
		expect(ids).toHaveLength(2);
		expect(new Set(ids).size).toBe(2);
	});
});
