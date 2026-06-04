import {ReactNode} from 'react';
import {useTheme} from '../../themes';

type PanelProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  accent?: string;
  compact?: boolean;
};

export function Panel({
  title,
  subtitle,
  children,
  className = '',
  accent,
  compact = false,
}: PanelProps) {
  const theme = useTheme();
  const resolvedAccent = accent || theme.colors.blue;

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl border font-mono shadow-2xl ${compact ? 'p-3' : 'p-4'} ${className}`}
      style={{
        background:
          'linear-gradient(135deg, rgba(8,11,18,0.98), rgba(13,17,23,0.98) 48%, rgba(18,24,33,0.96))',
        borderColor: theme.colors.border,
        color: theme.colors.text,
        boxShadow:
          '0 18px 50px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage:
            'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.15))',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${resolvedAccent}, transparent)`,
        }}
      />
      <div className="relative z-10 h-full">
        {title ? (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold leading-tight">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 truncate text-xs text-[#8b949e]">{subtitle}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
