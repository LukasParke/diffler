import {Easing, interpolate, useCurrentFrame} from 'remotion';

export function ProgressBar({
  value,
  max,
  color = '#3fb950',
  delay = 0,
  height = 8,
}: {
  value: number;
  max: number;
  color?: string;
  delay?: number;
  height?: number;
}) {
  const frame = useCurrentFrame();
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const emphasis = interpolate(frame, [delay, delay + 42], [0, 1], {
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
  });

  return (
    <div className="overflow-hidden rounded-full bg-white/10" style={{height}}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.78))`,
          boxShadow: `0 0 18px ${color}66`,
          opacity: 0.7 + emphasis * 0.3,
          transform: `scaleY(${0.72 + emphasis * 0.28})`,
        }}
      />
    </div>
  );
}
