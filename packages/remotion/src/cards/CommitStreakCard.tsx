import {UserStats} from '../data';
import {
	BigMetric,
	formatMetricValue,
	MetricTile,
	Panel,
	ProgressBar,
} from '../components/primitives';
import {useTheme} from '../themes';

export function CommitStreakCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const current = userStats.contributions.currentStreak;
	const longest = userStats.contributions.longestStreak;
	const comparison =
		longest === 0 && current === 0
			? 'No streak recorded'
			: `${formatMetricValue(current)} current / ${formatMetricValue(longest)} longest`;

	return (
		<Panel
			compact
			title="Contribution streak"
			subtitle="Consecutive days of GitHub contributions"
			accent={theme.colors.pink}
		>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.65fr)',
					alignItems: 'center',
					gap: 24,
					flex: 1,
					minHeight: 0,
				}}
			>
				<BigMetric
					label="Current streak"
					value={current}
					detail={current === 1 ? 'day' : 'days'}
				/>
				<MetricTile
					label="Personal best"
					value={longest}
					detail={longest === 1 ? 'day' : 'days'}
					accent={theme.colors.yellow}
					delay={0.08}
					style={{
						borderLeft: `1px solid ${theme.colors.border}`,
						paddingLeft: 24,
					}}
				/>
			</div>
			<div style={{marginTop: 12}}>
				<ProgressBar
					value={current}
					max={Math.max(longest, current)}
					color={theme.colors.pink}
					label="Current streak relative to personal best"
					height={3}
				/>
				<p style={{margin: '7px 0 0', fontSize: 10, color: theme.colors.muted}}>
					{userStats.collectionStatus.coreComplete
						? comparison
						: `${comparison} · partial history`}
				</p>
			</div>
		</Panel>
	);
}
