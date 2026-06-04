import {formatCompactNumber} from '../../utils/format';

export function BigMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-normal text-[#8b949e]">{label}</p>
      <p className="mt-1 text-4xl font-bold leading-none">
        {formatCompactNumber(value)}
      </p>
      {detail ? <p className="mt-1 text-xs text-[#8b949e]">{detail}</p> : null}
    </div>
  );
}
