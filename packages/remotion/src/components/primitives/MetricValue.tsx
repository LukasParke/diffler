import {CSSProperties} from 'react';
import {useTheme} from '../../themes';
import {AnimatedCounter} from '../effects/AnimatedCounter';
import {formatMetricValue, MetricFormat} from './formatMetric';

type MetricValueProps = {
	value: number | string;
	delay?: number;
	size?: number;
	format?: MetricFormat;
	style?: CSSProperties;
};

export function MetricValue({
	value,
	delay = 0,
	size = 28,
	format = 'auto',
	style,
}: MetricValueProps) {
	const theme = useTheme();
	const displayValue = formatMetricValue(value, format);
	const fittedSize = Math.max(
		11,
		size * Math.min(1, 6 / Math.max(1, displayValue.length)),
	);

	return (
		<span
			title={formatMetricValue(value, 'integer')}
			style={{
				display: 'block',
				minWidth: 0,
				maxWidth: '100%',
				overflow: 'hidden',
				textOverflow: 'ellipsis',
				whiteSpace: 'nowrap',
				fontFamily: theme.typography.fontFamily,
				fontSize: fittedSize,
				fontWeight: 500,
				fontVariantNumeric: 'tabular-nums',
				letterSpacing: '-0.04em',
				lineHeight: 1.2,
				// Fira Code's ink extends past a compact line box. Keep paint room
				// for its ascenders/descenders and the 3px reveal without moving the baseline.
				paddingTop: '0.14em',
				paddingBottom: 'calc(0.14em + 3px)',
				marginTop: '-0.14em',
				marginBottom: 'calc(-0.14em - 3px)',
				color: theme.colors.text,
				...style,
			}}
		>
			{typeof value === 'number' ? (
				<AnimatedCounter value={value} delay={delay} format={format} />
			) : (
				displayValue
			)}
		</span>
	);
}
