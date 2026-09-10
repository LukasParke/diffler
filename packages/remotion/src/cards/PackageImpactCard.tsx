import {UserStats} from '../data';
import {EmptyState, formatMetricValue, MetricTile, Panel} from '../components/primitives';
import {useTheme} from '../themes';

export function PackageImpactCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const metrics = userStats.packages;
	const providers = metrics.providers.join(' + ') || 'Package registries';

	return (
		<Panel
			compact
			title="Package impact"
			subtitle={`${providers} · ${formatMetricValue(metrics.packageCount)} published packages`}
			accent={theme.colors.purple}
			footer={metrics.complete ? 'Registry downloads · not unique users' : 'Partial registry coverage · known downloads shown'}
		>
			{metrics.packageCount === 0 ? (
				<EmptyState
					title={metrics.complete ? 'No packages configured' : 'Registry data unavailable'}
					detail="Configure package sources to showcase download activity."
				/>
			) : (
				<>
					<div style={{display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16}}>
						<MetricTile label="Last 30 days" value={metrics.downloads.lastMonth} accent={theme.colors.purple} />
						<MetricTile label="Last year" value={metrics.downloads.lastYear} accent={theme.colors.cyan} delay={0.08} />
						<MetricTile label="All-time downloads" value={metrics.downloads.allTime} accent={theme.colors.green} delay={0.16} />
					</div>
					<div style={{display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12, paddingTop: 8, borderTop: `1px solid ${theme.colors.border}`}}>
						{metrics.packages.slice(0, 3).map((item) => (
							<div key={`${item.provider}:${item.name}`} style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px', gap: 12, alignItems: 'center', fontSize: 11, lineHeight: '20px'}}>
								<span title={item.name} style={{minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>
									{item.name}
								</span>
								<span title={`${formatMetricValue(item.downloads.lastMonth, 'integer')} downloads / 30 days`} style={{color: theme.colors.muted, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
									{formatMetricValue(item.downloads.lastMonth, 'compact')} / mo
								</span>
							</div>
						))}
					</div>
				</>
			)}
		</Panel>
	);
}
