import {describe, expect, it} from 'vitest';
import {
	fadeInAndSlideUp,
	interpolateFactory,
	motionProgress,
	subtleReveal,
} from './animation';

describe('frame-based motion', () => {
	it('measures the same elapsed time at different frame rates', () => {
		expect(motionProgress(15, {fps: 30, duration: 1})).toBe(0.5);
		expect(motionProgress(30, {fps: 60, duration: 1})).toBe(0.5);
	});

	it('clamps negative frames and delayed starts', () => {
		expect(motionProgress(-12, {fps: 24, delay: 0.5})).toBe(0);
	});

	it('settles rather than extrapolating after the end', () => {
		expect(motionProgress(600, {fps: 30, duration: 0.5})).toBe(1);
	});

	it('handles an instantaneous reveal at its delayed start', () => {
		expect(motionProgress(14, {fps: 30, delay: 0.5, duration: 0})).toBe(0);
		expect(motionProgress(15, {fps: 30, delay: 0.5, duration: 0})).toBe(1);
	});

	it('starts readable without an elastic off-canvas translation', () => {
		expect(subtleReveal(0, {fps: 30})).toEqual({
			opacity: 0.88,
			transform: 'translateY(3px)',
		});
	});

	it('finishes on a precise resting position', () => {
		expect(subtleReveal(60, {fps: 30, duration: 1})).toEqual({
			opacity: 1,
			transform: 'translateY(0px)',
		});
	});

	it('keeps the legacy slide delay in frames while respecting the supplied FPS', () => {
		expect(fadeInAndSlideUp(45, 30, 30)).toEqual(subtleReveal(30, {fps: 60}));
	});

	it('allows the positional interpolation helper to use a composition frame rate', () => {
		expect(interpolateFactory(90, 1, 1, 0.8, 60)).toBe(0.4);
	});
});
