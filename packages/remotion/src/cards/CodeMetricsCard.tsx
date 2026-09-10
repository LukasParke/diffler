import {UserStats} from '../data';
import {
	BigMetric,
	formatCodeSize,
	formatMetricValue,
	getOptionalMetricCoverage,
	MetricRow,
	Panel,
	ProgressBar,
} from '../components/primitives';
import {useTheme} from '../themes';

export function CodeMetricsCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const coverage = getOptionalMetricCoverage(userStats, 'lines');

	return (
		<Panel
			title="Code metrics"
			subtitle={
				userStats.collectionStatus.coreComplete
					? 'Language bytes and contributor history'
					: 'Partial code collection'
			}
			accent={theme.colors.cyan}
			footer={
				<div
					style={{
						borderTop: `1px solid ${theme.colors.border}`,
						paddingTop: 10,
					}}
				>
					<p style={{margin: 0, color: theme.colors.text}}>
						Line history · {coverage.label.toLowerCase()}
					</p>
					<p style={{margin: '4px 0 0'}}>{coverage.detail}</p>
					{coverage.total > 0 ? (
						<ProgressBar
							value={coverage.completed}
							max={coverage.total}
							color={theme.colors.cyan}
							height={3}
							label="Line history repository coverage"
							style={{marginTop: 8}}
						/>
					) : null}
				</div>
			}
		>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
					alignItems: 'center',
					gap: 26,
					flex: 1,
					minHeight: 0,
				}}
			>
				<BigMetric
					label="Indexed code"
					value={formatCodeSize(userStats.code.codeByteTotal)}
					detail={`${formatMetricValue(userStats.summary.languageCount)} languages`}
				/>
				<div style={{minWidth: 0}}>
					<MetricRow
						label="Lines added"
						value={coverage.available ? userStats.code.linesAdded : '—'}
						icon={<span>+</span>}
						accent={theme.colors.green}
					/>
					<MetricRow
						label="Lines deleted"
						value={coverage.available ? userStats.code.linesDeleted : '—'}
						icon={<span>−</span>}
						accent={theme.colors.pink}
						delay={0.06}
					/>
					<MetricRow
						label="Lines changed"
						value={coverage.available ? userStats.code.linesOfCodeChanged : '—'}
						delay={0.12}
					/>
				</div>
			</div>
		</Panel>
	);
}
