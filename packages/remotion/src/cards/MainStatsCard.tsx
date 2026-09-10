import {UserStats} from '../data';
import {
	CollectionNote,
	formatMetricValue,
	getOptionalMetricCoverage,
	MetricTile,
	Panel,
} from '../components/primitives';
import {useTheme} from '../themes';

export function MainStatsCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const traffic = getOptionalMetricCoverage(userStats, 'traffic');
	return (
		<Panel
			compact
			title="At a glance"
			subtitle={`@${userStats.username}`}
			accent={theme.colors.pink}
			footer={<CollectionNote userStats={userStats} />}
		>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					flex: 1,
					minHeight: 0,
					gap: 14,
				}}
			>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
						gap: 18,
					}}
				>
					<MetricTile
						label="Contributions"
						value={userStats.summary.totalContributions}
						detail={`${formatMetricValue(userStats.summary.currentStreak)} day streak`}
						accent={theme.colors.pink}
					/>
					<MetricTile
						label="Stars"
						value={userStats.summary.starsReceived}
						detail="received"
						accent={theme.colors.yellow}
						delay={0.06}
					/>
					<MetricTile
						label="Repositories"
						value={userStats.summary.totalRepos}
						detail={`${formatMetricValue(userStats.summary.activeRepos)} active`}
						accent={theme.colors.purple}
						delay={0.12}
					/>
				</div>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
						gap: 18,
						borderTop: `1px solid ${theme.colors.border}`,
						paddingTop: 14,
					}}
				>
					<MetricTile
						label="Pull requests"
						value={userStats.community.totalPullRequests}
						detail={`${formatMetricValue(userStats.community.totalPullRequestReviews)} reviews`}
						accent={theme.colors.purple}
						delay={0.18}
					/>
					<MetricTile
						label="Languages"
						value={userStats.summary.languageCount}
						detail={userStats.topLanguages[0]?.languageName ?? 'Not collected'}
						accent={theme.colors.cyan}
						delay={0.24}
					/>
					<MetricTile
						label="Views / 14 days"
						value={traffic.available ? userStats.repositories.repoViews : '—'}
						detail={traffic.label}
						accent={theme.colors.pink}
						delay={0.3}
					/>
				</div>
			</div>
		</Panel>
	);
}
