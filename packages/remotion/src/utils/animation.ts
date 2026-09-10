import {FPS} from '../config';

export type MotionTiming = {
	fps: number;
	/** Seconds, relative to startFrame. */
	delay?: number;
	/** Seconds. Zero duration settles immediately at the start frame. */
	duration?: number;
	startFrame?: number;
};

/** A clamped timeline that depends only on the supplied frame and frame rate. */
export function motionProgress(
	frame: number,
	{fps, delay = 0, duration = 0.65, startFrame = 0}: MotionTiming,
): number {
	const frameRate = Number.isFinite(fps) && fps > 0 ? fps : FPS;
	const start = startFrame + delay * frameRate;
	if (duration <= 0) return frame >= start ? 1 : 0;
	return Math.min(1, Math.max(0, (frame - start) / (duration * frameRate)));
}

/** A readable first frame, followed by a small, non-springing typographic reveal. */
export function subtleReveal(frame: number, timing: MotionTiming) {
	const progress = motionProgress(frame, timing);
	const remaining = (1 - progress) ** 3;
	return {
		opacity: 1 - 0.12 * remaining,
		transform: `translateY(${3 * remaining}px)`,
	};
}

/** Legacy delay is in frames; new callers should supply their composition FPS. */
export const fadeInAndSlideUp = (frame: number, delay = 0, fps = FPS) =>
	subtleReveal(frame - delay, {fps});

/** Legacy positional API. The optional fifth argument is the composition FPS. */
// eslint-disable-next-line max-params -- Preserve the positional API; prefer motionProgress for new callers.
export function interpolateFactory(
	frame: number,
	delayInSeconds: number,
	durationInSeconds: number,
	finalOpacity = 1,
	fps = FPS,
) {
	return (
		motionProgress(frame, {
			fps,
			delay: delayInSeconds,
			duration: durationInSeconds,
		}) * finalOpacity
	);
}
