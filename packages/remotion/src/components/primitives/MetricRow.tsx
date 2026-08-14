import {ReactNode} from 'react';
import {AnimatedCounter} from '../effects/AnimatedCounter';
import {useTheme} from '../../themes';

type MetricRowProps = {
  label: string;
  value: number | string;
  detail?: string;
  delay?: number;
  accent?: string;
  icon?: ReactNode;
};

export function MetricRow({
  label,
  value,
  detail,
  delay = 0,
  accent,
  icon,
}: MetricRowProps) {
  const theme = useTheme();
  const resolvedAccent = accent || theme.colors.blue;

  const displayValue =
    typeof value === 'number' ? (
      <AnimatedCounter value={value} duration={2} delay={delay} />
    ) : (
      value
    );

  return (
    <div className="flex min-h-[30px] items-center justify-between gap-3 border-b border-white/5 py-1.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span className="shrink-0" style={{color: resolvedAccent}}>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs text-[#b7c0cc]">{label}</p>
          {detail ? (
            <p className="truncate text-xs text-[#7d8590]">{detail}</p>
          ) : null}
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">
        {displayValue}
      </p>
    </div>
  );
}
