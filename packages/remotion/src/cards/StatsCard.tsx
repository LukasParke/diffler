import {
	BookOpen,
	Code2,
	GitCommitHorizontal,
	GitPullRequest,
	Star,
	Eye,
} from 'lucide-react';
import {UserStats} from '../data';
import {
	CollectionNote,
	formatMetricValue,
	getOptionalMetricCoverage,
	MetricRow,
	Panel,
} from '../components/primitives';
import {useTheme} from '../themes';

export function StatsCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const traffic = getOptionalMetricCoverage(userStats, 'traffic');
	const rows = [
		{
			icon: <Star size={15} strokeWidth={1.5} />,
			label: 'Stars received',
			value: userStats.summary.starsReceived,
			detail: `${formatMetricValue(userStats.summary.forksReceived)} forks`,
			accent: theme.colors.yellow,
		},
		{
			icon: <GitCommitHorizontal size={15} strokeWidth={1.5} />,
			label: 'Profile commits',
			value: userStats.contributions.totalCommits,
			detail: `${formatMetricValue(userStats.contributions.totalContributions)} contributions`,
			accent: theme.colors.pink,
		},
		{
			icon: <GitPullRequest size={15} strokeWidth={1.5} />,
			label: 'Pull requests',
			value: userStats.community.totalPullRequests,
			detail: `${formatMetricValue(userStats.community.totalPullRequestReviews)} reviews`,
			accent: theme.colors.purple,
		},
		{
			icon: <BookOpen size={15} strokeWidth={1.5} />,
			label: 'Public repositories',
			value: userStats.repositories.publicRepos,
			detail: `${formatMetricValue(userStats.repositories.activeRepos)} active repositories`,
			accent: theme.colors.purple,
		},
		{
			icon: <Code2 size={15} strokeWidth={1.5} />,
			label: 'Languages',
			value: userStats.summary.languageCount,
			detail: userStats.topLanguages[0]?.languageName ?? 'No language data',
			accent: theme.colors.cyan,
		},
		{
			icon: <Eye size={15} strokeWidth={1.5} />,
			label: 'Repository views',
			value: traffic.available ? userStats.repositories.repoViews : '—',
			detail: `14 days · ${traffic.label.toLowerCase()}`,
			accent: theme.colors.pink,
		},
	];

	return (
		<Panel
			compact
			title="GitHub stats"
			subtitle={`@${userStats.username}`}
			accent={theme.colors.purple}
			footer={<CollectionNote userStats={userStats} />}
		>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					flex: 1,
					minHeight: 0,
				}}
			>
				{rows.map((row, index) => (
					<MetricRow
						key={row.label}
						{...row}
						delay={index * 0.055}
						separator={index !== rows.length - 1}
						style={{padding: '2px 0'}}
					/>
				))}
			</div>
		</Panel>
	);
}
