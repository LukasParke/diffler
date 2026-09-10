import {CSSProperties, ReactNode} from 'react';
import {useTheme} from '../../themes';
import {MetricValue} from './MetricValue';
import {formatMetricValue} from './formatMetric';

type MetricRowProps = {
	label: string;
	value: number | string;
	detail?: string;
	delay?: number;
	accent?: string;
	icon?: ReactNode;
	separator?: boolean;
	style?: CSSProperties;
	labelStyle?: CSSProperties;
	valueStyle?: CSSProperties;
};

export function MetricRow({
	label,
	value,
	detail,
	delay = 0,
	accent,
	icon,
	separator = false,
	style,
	labelStyle,
	valueStyle,
}: MetricRowProps) {
	const theme = useTheme();

	return (
		<div
			role="group"
			aria-label={`${label.replace(/:$/, '')}: ${formatMetricValue(value, 'integer')}`}
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: 12,
				minWidth: 0,
				padding: '5px 0',
				fontFamily: theme.typography.fontFamily,
				color: theme.colors.text,
				borderBottom: separator
					? `1px solid ${theme.colors.border}`
					: undefined,
				...style,
			}}
		>
			<div style={{display: 'flex', alignItems: 'center', gap: 9, minWidth: 0}}>
				{icon ? (
					<span
						aria-hidden="true"
						style={{
							display: 'flex',
							flexShrink: 0,
							color: accent ?? theme.colors.purple,
						}}
					>
						{icon}
					</span>
				) : null}
				<div style={{minWidth: 0}}>
					<p
						title={label}
						style={{
							margin: 0,
							fontSize: 12,
							lineHeight: 1.45,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
							...labelStyle,
						}}
					>
						{label}
					</p>
					{detail ? (
						<p
							title={detail}
							style={{
								margin: '2px 0 0',
								fontSize: 10,
								lineHeight: 1.35,
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
			</div>
			<MetricValue
				value={value}
				delay={delay}
				size={15}
				style={{flexShrink: 0, maxWidth: '45%', ...valueStyle}}
			/>
		</div>
	);
}
