import {UserStats} from '../data';
import {
	formatMetricValue,
	getOptionalMetricCoverage,
	MetricTile,
	Panel,
	ProgressBar,
} from '../components/primitives';
import {useTheme} from '../themes';

export function RepositoryImpactCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const repos = userStats.repositories;
	const traffic = getOptionalMetricCoverage(userStats, 'traffic');
	const privacyDetail = userStats.privacy.privateRepositoryDetailsIncluded
		? 'Includes private repository details'
		: userStats.privacy.redactedPrivateRepositories > 0
			? `${formatMetricValue(userStats.privacy.redactedPrivateRepositories)} private repositories redacted`
			: repos.privateRepos > 0
				? `${formatMetricValue(repos.privateRepos)} private repositories · totals only`
				: 'Public repository totals';
	const ratios = [
		{label: 'Public', value: repos.publicRepos, color: theme.colors.purple},
		{label: 'Original', value: repos.originalRepos, color: theme.colors.cyan},
		{label: 'Active', value: repos.activeRepos, color: theme.colors.pink},
	];

	return (
		<Panel
			compact
			title="Repository impact"
			subtitle={`${formatMetricValue(repos.totalRepos)} repositories${userStats.collectionStatus.coreComplete ? '' : ' · partial collection'}`}
			accent={theme.colors.yellow}
			footer={privacyDetail}
		>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
					gap: 20,
				}}
			>
				<MetricTile
					label="Stars"
					value={repos.starCount}
					accent={theme.colors.yellow}
				/>
				<MetricTile
					label="Forks"
					value={repos.forkCount}
					accent={theme.colors.purple}
					delay={0.06}
				/>
				<MetricTile
					label="Views / 14 days"
					value={traffic.available ? repos.repoViews : '—'}
					detail={traffic.label}
					accent={theme.colors.pink}
					delay={0.12}
				/>
			</div>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					flex: 1,
					minHeight: 0,
					borderTop: `1px solid ${theme.colors.border}`,
					marginTop: 14,
					paddingTop: 9,
					gap: 5,
				}}
			>
				{ratios.map((ratio, index) => (
					<div
						key={ratio.label}
						style={{
							display: 'grid',
							gridTemplateColumns: '100px minmax(0, 1fr) 100px',
							gap: 12,
							alignItems: 'center',
							fontSize: 11,
						}}
					>
						<span style={{color: theme.colors.muted}}>{ratio.label}</span>
						<ProgressBar
							value={ratio.value}
							max={repos.totalRepos}
							color={ratio.color}
							height={3}
							delaySeconds={index * 0.05}
							label={`${ratio.label} repositories`}
						/>
						<span
							title={`${formatMetricValue(ratio.value, 'integer')} of ${formatMetricValue(repos.totalRepos, 'integer')} repositories`}
							style={{
								textAlign: 'right',
								whiteSpace: 'nowrap',
								fontVariantNumeric: 'tabular-nums',
							}}
						>
							{formatMetricValue(ratio.value, 'compact')} /{' '}
							{formatMetricValue(repos.totalRepos, 'compact')}
						</span>
					</div>
				))}
			</div>
		</Panel>
	);
}
