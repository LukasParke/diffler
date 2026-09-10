import {UserStats} from '../data';
import {
	CollectionNote,
	ContributionTimeline,
	formatMetricValue,
	MetricTile,
	Panel,
} from '../components/primitives';
import {useTheme} from '../themes';

export function ActivityOverviewCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const timeline = userStats.contributions.timeline.slice(-6);
	const peakDay = userStats.contributions.peakDay;

	return (
		<Panel
			title="Activity overview"
			subtitle={`${formatMetricValue(userStats.contributions.totalContributions)} recorded contributions`}
			accent={theme.colors.purple}
			footer={<CollectionNote userStats={userStats} />}
		>
			<div
				style={{flex: 1, minHeight: 100, display: 'flex', alignItems: 'center'}}
			>
				<ContributionTimeline points={timeline} />
			</div>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
					gap: 18,
					marginTop: 16,
					paddingTop: 16,
					borderTop: `1px solid ${theme.colors.border}`,
				}}
			>
				<MetricTile
					label="Current streak"
					value={userStats.contributions.currentStreak}
					detail="days"
					accent={theme.colors.pink}
				/>
				<MetricTile
					label="Longest streak"
					value={userStats.contributions.longestStreak}
					detail="days"
					delay={0.06}
					accent={theme.colors.yellow}
				/>
				<MetricTile
					label="Peak day"
					value={peakDay?.contributions ?? '—'}
					detail={peakDay?.date ?? 'Not collected'}
					delay={0.12}
					accent={theme.colors.purple}
				/>
			</div>
		</Panel>
	);
}
