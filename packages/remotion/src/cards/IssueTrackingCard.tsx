import {UserStats} from '../data';
import {
	BigMetric,
	formatMetricValue,
	MetricRow,
	Panel,
	ProgressBar,
} from '../components/primitives';
import {useTheme} from '../themes';

export function IssueTrackingCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const community = userStats.community;
	const totalIssues = community.openIssues + community.closedIssues;

	return (
		<Panel
			compact
			title="Community work"
			subtitle={`${formatMetricValue(community.repositoriesContributedTo)} repositories contributed to${userStats.collectionStatus.coreComplete ? '' : ' · partial collection'}`}
			accent={theme.colors.purple}
		>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
					gap: 28,
					alignItems: 'center',
				}}
			>
				<BigMetric
					label="Pull requests"
					value={community.totalPullRequests}
					detail={`${formatMetricValue(community.totalPullRequestReviews)} reviews`}
				/>
				<div style={{minWidth: 0}}>
					<MetricRow label="Open issues" value={community.openIssues} />
					<MetricRow
						label="Closed issues"
						value={community.closedIssues}
						delay={0.06}
					/>
					<ProgressBar
						value={community.closedIssues}
						max={totalIssues}
						color={theme.colors.purple}
						height={3}
						label="Share of issues closed"
						style={{marginTop: 6}}
					/>
				</div>
			</div>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					flex: 1,
					minHeight: 0,
					marginTop: 10,
					paddingTop: 4,
					borderTop: `1px solid ${theme.colors.border}`,
				}}
			>
				<MetricRow
					label="Discussions started"
					value={community.discussionsStarted}
					detail={`${formatMetricValue(community.discussionsAnswered)} discussions answered`}
					delay={0.12}
					style={{padding: '2px 0'}}
				/>
				<MetricRow
					label="Followers"
					value={community.followers}
					detail={`${formatMetricValue(community.following)} following`}
					delay={0.18}
					style={{padding: '2px 0'}}
				/>
			</div>
		</Panel>
	);
}
