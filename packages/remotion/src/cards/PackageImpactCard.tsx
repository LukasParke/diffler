import {Box, CalendarDays, Download, PackageOpen} from 'lucide-react';
import {UserStats} from '../data';
import {MetricRow, Panel} from '../components/primitives';
import {defaultTheme} from '../themes/default';
import {formatCompactNumber} from '../utils';

export function PackageImpactCard({userStats}: {userStats: UserStats}) {
	const metrics = userStats.packages;
	const providerLabel =
		metrics.providers.length > 0
			? metrics.providers.join(' + ')
			: 'Package registries';

	return (
		<Panel
			title="Package Impact"
			subtitle={`${providerLabel} · ${metrics.packageCount} published packages`}
			accent={defaultTheme.colors.purple}
		>
			{metrics.packageCount === 0 ? (
				<div className="flex h-[208px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] text-sm text-[#9ba7b4]">
					Configure package sources to showcase install activity
				</div>
			) : (
				<div className="grid h-[208px] grid-cols-[0.92fr_1.08fr] gap-3">
					<div className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
						<MetricRow
							icon={<Download size={14} />}
							label="Last 30 days"
							value={formatCompactNumber(metrics.downloads.lastMonth)}
							accent={defaultTheme.colors.purple}
						/>
						<MetricRow
							icon={<CalendarDays size={14} />}
							label="Last year"
							value={formatCompactNumber(metrics.downloads.lastYear)}
							delay={0.08}
							accent={defaultTheme.colors.cyan}
						/>
						<MetricRow
							icon={<PackageOpen size={14} />}
							label="All-time downloads"
							value={formatCompactNumber(metrics.downloads.allTime)}
							delay={0.16}
							accent={defaultTheme.colors.green}
						/>
						<MetricRow
							icon={<Box size={14} />}
							label="Published packages"
							value={metrics.packageCount}
							delay={0.24}
							accent={defaultTheme.colors.yellow}
						/>
					</div>
					<div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.035] p-3">
						<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7d8590]">
							Top packages this month
						</p>
						{metrics.packages.slice(0, 3).map((item) => (
							<div
								key={`${item.provider}:${item.name}`}
								className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2 last:border-0 last:pb-0"
							>
								<div className="min-w-0">
									<p className="truncate text-xs font-semibold">{item.name}</p>
									<p className="mt-0.5 truncate text-[10px] text-[#7d8590]">
										{item.provider}
										{item.latestVersion ? ` · v${item.latestVersion}` : ''}
									</p>
								</div>
								<div className="shrink-0 text-right">
									<p className="text-sm font-semibold tabular-nums">
										{formatCompactNumber(item.downloads.lastMonth)}
									</p>
									<p className="text-[10px] text-[#7d8590]">downloads</p>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</Panel>
	);
}
