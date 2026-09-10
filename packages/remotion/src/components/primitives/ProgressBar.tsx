import {CSSProperties} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {useTheme} from '../../themes';
import {subtleReveal} from '../../utils/animation';

export function ProgressBar({
	value,
	max,
	color,
	delay = 0,
	delaySeconds,
	duration = 0.65,
	height = 4,
	label = 'Proportion',
	style,
}: {
	value: number;
	max: number;
	color?: string;
	/** Legacy delay in frames. Prefer delaySeconds in new compositions. */
	delay?: number;
	delaySeconds?: number;
	duration?: number;
	height?: number;
	label?: string;
	style?: CSSProperties;
}) {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const theme = useTheme();
	const percent =
		Number.isFinite(value) && Number.isFinite(max) && max > 0
			? Math.min(100, Math.max(0, (value / max) * 100))
			: 0;
	const {opacity} = subtleReveal(frame, {
		fps,
		duration,
		delay: delaySeconds ?? 0,
		startFrame: delaySeconds === undefined ? delay : 0,
	});

	return (
		<div
			role="meter"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
			style={{
				height,
				minWidth: 0,
				width: '100%',
				overflow: 'hidden',
				borderRadius: theme.radii.panel,
				backgroundColor: theme.colors.panelLight,
				...style,
			}}
		>
			<div
				style={{
					height: '100%',
					width: `${percent}%`,
					opacity,
					borderRadius: theme.radii.panel,
					backgroundColor: color ?? theme.colors.purple,
				}}
			/>
		</div>
	);
}
