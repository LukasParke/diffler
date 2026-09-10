import {useCurrentFrame, useVideoConfig} from 'remotion';
import {UserStats} from '../../data';
import {useTheme} from '../../themes';
import {motionProgress} from '../../utils/animation';
import {formatMetricValue} from './formatMetric';
import {EmptyState} from './EmptyState';

export function ContributionTimeline({
	points,
}: {
	points: UserStats['contributions']['timeline'];
}) {
	const theme = useTheme();
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (points.length === 0) {
		return (
			<EmptyState
				title="No contribution timeline yet"
				detail="Period totals will appear when contribution history is collected."
			/>
		);
	}

	const max = Math.max(1, ...points.map((point) => point.contributions));
	const positions = points.map((point, index) => ({
		...point,
		x: points.length === 1 ? 220 : 32 + (index / (points.length - 1)) * 376,
		y: 96 - (Math.max(0, point.contributions) / max) * 66,
	}));
	const path = positions
		.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
		.join(' ');
	const progress = motionProgress(frame, {fps, duration: 1.1});
	const drawn = 0.18 + 0.82 * (1 - (1 - progress) ** 3);
	const summary = points
		.map(
			(point) =>
				`${point.period}: ${formatMetricValue(point.contributions, 'integer')} contributions`,
		)
		.join('; ');

	return (
		<svg
			viewBox="0 0 440 132"
			role="img"
			aria-label={`Contributions by period: ${summary}`}
			style={{
				display: 'block',
				width: '100%',
				height: '100%',
				minHeight: 100,
				overflow: 'visible',
				fontFamily: theme.typography.fontFamily,
			}}
		>
			<title>{summary}</title>
			<path d="M12 102H428" stroke={theme.colors.border} strokeWidth={1} />
			<path
				d={path}
				fill="none"
				stroke={theme.colors.border}
				strokeWidth={1.5}
				strokeLinejoin="round"
			/>
			<path
				d={path}
				pathLength={1}
				fill="none"
				stroke={theme.colors.purple}
				strokeWidth={1.5}
				strokeLinejoin="round"
				strokeDasharray="1 1"
				strokeDashoffset={1 - drawn}
			/>
			{positions.map((point, index) => (
				<g key={`${point.period}-${index}`}>
					<path
						d={`M${point.x} ${point.y + 5}V102`}
						stroke={theme.colors.border}
						strokeWidth={1}
					/>
					<circle
						cx={point.x}
						cy={point.y}
						r={3}
						fill={
							index === positions.length - 1
								? theme.colors.pink
								: theme.colors.background
						}
						stroke={
							index === positions.length - 1
								? theme.colors.pink
								: theme.colors.purple
						}
						strokeWidth={1.5}
					/>
					<text
						x={point.x}
						y={point.y - 12}
						textAnchor="middle"
						fontSize={10}
						fontWeight={500}
						fill={theme.colors.text}
					>
						{formatMetricValue(point.contributions, 'compact')}
					</text>
					<text
						x={point.x}
						y={122}
						textAnchor="middle"
						fontSize={10}
						fill={theme.colors.muted}
					>
						{point.period.length > 8
							? `${point.period.slice(0, 7)}…`
							: point.period}
					</text>
				</g>
			))}
		</svg>
	);
}
