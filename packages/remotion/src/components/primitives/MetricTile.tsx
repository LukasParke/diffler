import {CSSProperties, ReactNode} from 'react';
import {useTheme} from '../../themes';
import {MetricValue} from './MetricValue';

type MetricTileProps = {
	label: string;
	value: number | string;
	detail?: string;
	delay?: number;
	accent?: string;
	icon?: ReactNode;
	large?: boolean;
	style?: CSSProperties;
};

/** An open typographic metric, not an additional card inside its parent. */
export function MetricTile({
	label,
	value,
	detail,
	delay = 0,
	accent,
	icon,
	large = false,
	style,
}: MetricTileProps) {
	const theme = useTheme();
	const resolvedAccent = accent ?? theme.colors.purple;

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 5,
				minWidth: 0,
				fontFamily: theme.typography.fontFamily,
				color: theme.colors.text,
				...style,
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 7,
					minWidth: 0,
					color: theme.colors.muted,
				}}
			>
				<span
					aria-hidden="true"
					style={{display: 'flex', flexShrink: 0, color: resolvedAccent}}
				>
					{icon ?? (
						<span
							style={{
								width: 4,
								height: 4,
								borderRadius: theme.radii.panel,
								backgroundColor: resolvedAccent,
							}}
						/>
					)}
				</span>
				<p
					title={label}
					style={{
						margin: 0,
						fontSize: 11,
						fontWeight: 400,
						lineHeight: 1.35,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
					}}
				>
					{label}
				</p>
			</div>
			<MetricValue value={value} delay={delay} size={large ? 38 : 28} />
			{detail ? (
				<p
					title={detail}
					style={{
						margin: 0,
						color: theme.colors.muted,
						fontSize: 10,
						lineHeight: 1.4,
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
