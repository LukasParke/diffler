import {ReactNode} from 'react';
import {AnimatedCounter} from '../effects/AnimatedCounter';
import {useTheme} from '../../themes';

type MetricTileProps = {
  label: string;
  value: number | string;
  detail?: string;
  delay?: number;
  accent?: string;
  icon?: ReactNode;
  large?: boolean;
};

export function MetricTile({
  label,
  value,
  detail,
  delay = 0,
  accent,
  icon,
  large = false,
}: MetricTileProps) {
  const theme = useTheme();
  const resolvedAccent = accent || theme.colors.blue;

  const displayValue =
    typeof value === 'number' ? (
      <AnimatedCounter value={value} duration={1.8} delay={delay} />
    ) : (
      value
    );

  return (
    <div
      className={`relative h-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] ${large ? 'p-3' : 'p-2.5'}`}
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{background: `linear-gradient(90deg, ${resolvedAccent}, transparent)`}}
      />
      <div
        className={`flex h-full flex-col justify-between ${large ? 'gap-2' : 'gap-1'}`}
      >
        <div className="flex items-center gap-2 text-[#9ba7b4]">
          {icon ? (
            <span className="shrink-0" style={{color: resolvedAccent}}>
              {icon}
            </span>
          ) : null}
          <p className="truncate text-[11px] font-semibold uppercase tracking-normal">
            {label}
          </p>
        </div>
        <p
          className={`${large ? 'text-4xl' : 'text-2xl'} font-bold leading-none tabular-nums text-[#f0f3f6]`}
        >
          {displayValue}
        </p>
        {detail ? (
          <p className="truncate text-[11px] leading-tight text-[#8b949e]">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
