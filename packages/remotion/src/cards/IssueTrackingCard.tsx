import {UserStats} from '../data';
import {MetricTile, Panel, ProgressBar} from '../components/primitives';
import {defaultTheme} from '../themes/default';
import {GitPullRequest, MessageSquareText, UsersRound} from 'lucide-react';

export function IssueTrackingCard({userStats}: {userStats: UserStats}) {
	const opened = userStats.community.openIssues;
	const closed = userStats.community.closedIssues;
	const total = opened + closed;
	const discussions =
		userStats.community.discussionsStarted +
		userStats.community.discussionsAnswered;

	return (
		<Panel
			title="Community Work"
			subtitle={`${userStats.community.repositoriesContributedTo} repositories contributed to`}
			accent={defaultTheme.colors.purple}
		>
			<div className="grid h-[198px] grid-cols-[1fr_1fr] gap-3">
				<div className="grid grid-cols-2 gap-2">
					<MetricTile
						icon={<GitPullRequest size={14} />}
						label="PRs"
						value={userStats.community.totalPullRequests}
						detail={`${userStats.community.totalPullRequestReviews} reviews`}
						accent={defaultTheme.colors.purple}
					/>
					<MetricTile
						icon={<MessageSquareText size={14} />}
						label="Talks"
						value={discussions}
						detail={`${userStats.community.discussionsAnswered} answered`}
						delay={0.08}
						accent={defaultTheme.colors.cyan}
					/>
					<MetricTile
						icon={<UsersRound size={14} />}
						label="Followers"
						value={userStats.community.followers}
						detail={`${userStats.community.following} following`}
						delay={0.16}
						accent={defaultTheme.colors.green}
					/>
					<MetricTile
						label="Reviews"
						value={userStats.community.totalPullRequestReviews}
						delay={0.24}
						accent={defaultTheme.colors.yellow}
					/>
				</div>
				<div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
					<div className="flex h-full flex-col justify-between">
						<div className="flex items-center justify-between">
							<p className="text-xs font-semibold uppercase tracking-normal text-[#9ba7b4]">
								Issues closed
							</p>
							<p className="text-lg font-bold tabular-nums">{closed}</p>
						</div>
						<div>
							<ProgressBar
								value={closed}
								max={Math.max(1, total)}
								color={defaultTheme.colors.green}
								height={10}
							/>
						</div>
						<p className="text-xs text-[#8b949e]">
							{opened} open, {closed} closed
						</p>
					</div>
				</div>
			</div>
		</Panel>
	);
}
