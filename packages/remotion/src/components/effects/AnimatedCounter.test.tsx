import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AnimatedCounter} from './AnimatedCounter';

const clock = vi.hoisted(() => ({frame: 0, fps: 30}));

vi.mock('remotion', async (importOriginal) => ({
	...(await importOriginal<typeof import('remotion')>()),
	useCurrentFrame: () => clock.frame,
	useVideoConfig: () => ({fps: clock.fps}),
}));

beforeEach(() => {
	clock.frame = 0;
	clock.fps = 30;
});

describe('AnimatedCounter', () => {
	it('keeps the actual statistic readable on the first frame, including during a delay', () => {
		const html = renderToStaticMarkup(
			<AnimatedCounter value={1234} delay={2} />,
		);
		expect(html).toContain('>1,234<');
	});

	it('keeps a large value compact while retaining its exact accessible total', () => {
		const html = renderToStaticMarkup(<AnimatedCounter value={1234567890} />);
		expect(html).toContain('>1.2B<');
		expect(html).toContain('aria-label="1,234,567,890"');
	});

	it('animates a four-digit value rather than disabling motion at one thousand', () => {
		const firstFrame = renderToStaticMarkup(
			<AnimatedCounter value={1000} duration={1} />,
		);
		clock.frame = 30;
		const settledFrame = renderToStaticMarkup(
			<AnimatedCounter value={1000} duration={1} />,
		);
		expect(firstFrame).toContain('translateY(3px)');
		expect(settledFrame).toContain('translateY(0px)');
	});

	it('uses the same reveal timing at 30 and 60 FPS', () => {
		clock.frame = 15;
		const thirtyFps = renderToStaticMarkup(
			<AnimatedCounter value={149} duration={1} />,
		);
		clock.fps = 60;
		clock.frame = 30;
		expect(
			renderToStaticMarkup(<AnimatedCounter value={149} duration={1} />),
		).toBe(thirtyFps);
	});

	it('counts only when an explicit starting value is supplied', () => {
		clock.frame = 15;
		expect(
			renderToStaticMarkup(
				<AnimatedCounter value={1000} from={0} duration={1} />,
			),
		).toContain('>875<');
	});

	it('settles an instantaneous count at its delayed start without dividing by zero', () => {
		clock.frame = 15;
		expect(
			renderToStaticMarkup(
				<AnimatedCounter value={42} from={0} delay={0.5} duration={0} />,
			),
		).toContain('>42<');
	});

	it('produces identical output when frames are rendered out of order', () => {
		clock.frame = 7;
		const first = renderToStaticMarkup(<AnimatedCounter value={9876543} />);
		clock.frame = 99;
		renderToStaticMarkup(<AnimatedCounter value={9876543} />);
		clock.frame = 7;
		expect(renderToStaticMarkup(<AnimatedCounter value={9876543} />)).toBe(
			first,
		);
	});

	it('settles on the exact target even when counting down from a much larger number', () => {
		clock.frame = 30;
		expect(
			renderToStaticMarkup(
				<AnimatedCounter value={1} from={1e20} duration={1} />,
			),
		).toContain('>1<');
	});
});
