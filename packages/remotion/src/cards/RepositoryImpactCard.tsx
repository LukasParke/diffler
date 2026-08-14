import {UserStats} from '../data';
import {MetricTile, Panel, ProgressBar} from '../components/primitives';
import {defaultTheme} from '../themes/default';
import {GitFork, ShieldCheck, Sparkles, Telescope} from 'lucide-react';

export function RepositoryImpactCard({userStats}: {userStats: UserStats}) {
	const repos = userStats.repositories;
	if (!userStats.summary.profileMetricsComplete) {
		return (
			<Panel
				title="Repository Impact"
				subtitle="Profile repository collection incomplete"
				accent={defaultTheme.colors.green}
			>
				<div className="flex h-[188px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] text-sm text-[#9ba7b4]">
					Repository impact metrics are not available yet
				</div>
			</Panel>
		);
	}

	const publicRepos =
		repos.publicRepos || repos.totalRepos - repos.privateRepos;
	const originalRepos =
		repos.originalRepos || repos.totalRepos - repos.forkedRepos;
	const privacyDetail =
		repos.privateRepos > 0
			? `${repos.privateRepos} private repos aggregate-only`
			: 'Public repositories only';

	return (
		<Panel
			title="Repository Impact"
			subtitle={privacyDetail}
			accent={defaultTheme.colors.green}
		>
			<div className="grid h-[188px] grid-cols-[1.1fr_0.9fr] gap-3">
				<div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
					<div>
						<div className="mb-1 flex justify-between gap-2 text-xs">
							<span className="truncate text-[#b7c0cc]">
								Public repositories
							</span>
							<span className="shrink-0 tabular-nums">
								{publicRepos}/{repos.totalRepos}
							</span>
						</div>
						<ProgressBar
							value={publicRepos}
							max={Math.max(1, repos.totalRepos)}
							color={defaultTheme.colors.green}
							height={8}
						/>
					</div>
					<div>
						<div className="mb-1 flex justify-between gap-2 text-xs">
							<span className="truncate text-[#b7c0cc]">
								Original repositories
							</span>
							<span className="shrink-0 tabular-nums">
								{originalRepos}/{repos.totalRepos}
							</span>
						</div>
						<ProgressBar
							value={originalRepos}
							max={Math.max(1, repos.totalRepos)}
							color={defaultTheme.colors.blue}
							delay={8}
							height={8}
						/>
					</div>
					<div>
						<div className="mb-1 flex justify-between gap-2 text-xs">
							<span className="truncate text-[#b7c0cc]">
								Active repositories
							</span>
							<span className="shrink-0 tabular-nums">{repos.activeRepos}</span>
						</div>
						<ProgressBar
							value={repos.activeRepos}
							max={Math.max(1, repos.totalRepos)}
							color={defaultTheme.colors.yellow}
							delay={16}
							height={8}
						/>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<MetricTile
						icon={<Sparkles size={14} />}
						label="Stars"
						value={repos.starCount}
						accent={defaultTheme.colors.yellow}
					/>
					<MetricTile
						icon={<GitFork size={14} />}
						label="Forks"
						value={repos.forkCount}
						delay={0.08}
						accent={defaultTheme.colors.green}
					/>
					<MetricTile
						icon={<Telescope size={14} />}
						label="Views"
						value={repos.repoViews ?? 'Unavailable'}
						detail={
							repos.repoViewUniques === null
								? 'Collection pending'
								: `${repos.repoViewUniques} unique`
						}
						delay={0.16}
						accent={defaultTheme.colors.cyan}
					/>
					<MetricTile
						icon={<ShieldCheck size={14} />}
						label="Private"
						value={userStats.privacy.redactedPrivateRepositories}
						detail="redacted"
						delay={0.24}
						accent={defaultTheme.colors.purple}
					/>
				</div>
			</div>
		</Panel>
	);
}
