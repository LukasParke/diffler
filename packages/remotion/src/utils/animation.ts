import {interpolate, Easing} from 'remotion';
import {FPS} from '../config';

export const fadeInAndSlideUp = (frame: number, delay = 0) => {
  const opacity = interpolate(
    frame - delay,
    [0, 20],
    [0, 1],
    {
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }
  );

  const y = interpolate(
    frame - delay,
    [0, 30],
    [50, 0],
    {
      extrapolateRight: 'clamp',
      easing: Easing.elastic(1),
    }
  );

  return {opacity, transform: `translateY(${y}px)`};
};

export function interpolateFactory(
  frame: number,
  delayInSeconds: number,
  durationInSeconds: number,
  finalOpacity = 1
) {
  const delay = delayInSeconds * FPS;
  const duration = durationInSeconds * FPS + delay;
  return interpolate(frame, [delay, duration], [0, finalOpacity], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
