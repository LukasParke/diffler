import {
	formatCompactNumber,
	formatInteger,
	humanReadableFileSize,
} from '../../utils/format';

export type MetricFormat = 'auto' | 'compact' | 'integer';

/** Keep small totals precise; compact only when a grouped total needs more space. */
export function formatMetricValue(
	value: number | string,
	format: MetricFormat = 'auto',
): string {
	if (typeof value === 'string') return value;
	if (!Number.isFinite(value)) return '—';
	const integer = formatInteger(Math.round(value));
	if (format === 'integer') return integer;
	if (format === 'compact' || integer.length > 7) {
		const compact = formatCompactNumber(Math.round(value));
		return compact.length > 7
			? value.toExponential(1).replace('e+', 'e').replace('.0e', 'e')
			: compact;
	}
	return integer;
}

/** Binary units, a bounded precision, and an honest empty value. */
export function formatCodeSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	const size = humanReadableFileSize(bytes, false, 1);
	return size.length > 12 ? `${formatMetricValue(bytes, 'compact')} B` : size;
}
