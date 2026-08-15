import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {formatInteger} from '../../utils/format';

type AnimatedCounterProps = {
  value: number;
  duration?: number;
  startFrame?: number;
  delay?: number;
};

export const AnimatedCounter = ({
  value,
  duration = 2,
  startFrame = 0,
  delay = 0,
}: AnimatedCounterProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const firstFrame = startFrame + delay * fps;
  const finalFrame = firstFrame + duration * fps;
  const emphasis = interpolate(frame, [firstFrame, finalFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <span
      style={{
        display: 'inline-block',
        opacity: 0.78 + emphasis * 0.22,
        transform: `scale(${0.97 + emphasis * 0.03})`,
      }}
    >
      {formatInteger(value)}
    </span>
  );
};
