import {CSSProperties} from 'react';
import {useTheme} from '../../themes';
import {MetricValue} from './MetricValue';

export function BigMetric({
	label,
	value,
	detail,
	delay = 0,
	style,
}: {
	label: string;
	value: number | string;
	detail?: string;
	delay?: number;
	style?: CSSProperties;
}) {
	const theme = useTheme();
	return (
		<div
			style={{
				minWidth: 0,
				fontFamily: theme.typography.fontFamily,
				color: theme.colors.text,
				...style,
			}}
		>
			<p
				style={{
					margin: '0 0 5px',
					fontSize: 11,
					lineHeight: 1.4,
					color: theme.colors.muted,
				}}
			>
				{label}
			</p>
			<MetricValue value={value} delay={delay} size={42} />
			{detail ? (
				<p
					title={detail}
					style={{
						margin: '5px 0 0',
						fontSize: 11,
						lineHeight: 1.4,
						color: theme.colors.muted,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
					}}
				>
					{detail}
				</p>
			) : null}
		</div>
	);
}
