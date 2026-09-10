import {CSSProperties} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {motionProgress, subtleReveal} from '../../utils/animation';
import {formatInteger} from '../../utils/format';
import {formatMetricValue, MetricFormat} from '../primitives/formatMetric';

type AnimatedCounterProps = {
	value: number;
	duration?: number;
	startFrame?: number;
	/** Seconds. The value remains readable while its reveal is delayed. */
	delay?: number;
	format?: MetricFormat;
	/** Opt in to a count-up. By default the true statistic is visible from frame 0. */
	from?: number;
	className?: string;
	style?: CSSProperties;
};

export const AnimatedCounter = ({
	value,
	duration = 0.65,
	startFrame = 0,
	delay = 0,
	format = 'auto',
	from,
	className,
	style,
}: AnimatedCounterProps) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const timing = {fps, duration, startFrame, delay};
	const progress = motionProgress(frame, timing);
	const currentValue =
		from === undefined || progress === 1
			? value
			: from + (value - from) * (1 - (1 - progress) ** 3);
	const resolvedFormat =
		format === 'auto' &&
		formatMetricValue(value) !== formatMetricValue(value, 'integer')
			? 'compact'
			: format;
	const exactValue = Number.isFinite(value)
		? formatInteger(Math.round(value))
		: 'Unavailable';

	return (
		<span
			className={className}
			aria-label={exactValue}
			title={exactValue}
			style={{
				display: 'inline-block',
				whiteSpace: 'nowrap',
				fontVariantNumeric: 'tabular-nums',
				...subtleReveal(frame, timing),
				...style,
			}}
		>
			{formatMetricValue(currentValue, resolvedFormat)}
		</span>
	);
};
