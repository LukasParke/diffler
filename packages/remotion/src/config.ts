import {DEFAULT_DURATION_SECONDS, DEFAULT_FPS} from '@lukasparke/diffler-schemas';

export const FPS = DEFAULT_FPS;
export const DurationInSeconds = DEFAULT_DURATION_SECONDS;
export const DurationInFrames = FPS * DurationInSeconds;

export const Config = {
	FPS,
	DurationInSeconds,
	DurationInFrames,
};
