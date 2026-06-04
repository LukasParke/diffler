import {UserStats} from '../data';
import {StatCard} from '../components/primitives';
import {defaultTheme} from '../themes/default';

export function MainStatsCard({userStats}: {userStats: UserStats}) {
	return (
		<div
			className="grid h-full grid-cols-3 grid-rows-2 gap-3 rounded-xl border border-white/10 p-3 text-white"
			style={{
				background:
					'linear-gradient(135deg, rgba(8,11,18,0.96), rgba(13,17,23,0.98))',
				boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
			}}
		>
			<StatCard
				title="Contributions"
				value={userStats.summary.totalContributions}
				detail={`${userStats.summary.currentStreak} day streak`}
				accent={defaultTheme.colors.green}
				delay={0}
			/>
			<StatCard
				title="Stars"
				value={userStats.summary.starsReceived}
				detail="received"
				accent={defaultTheme.colors.yellow}
				delay={0.12}
			/>
			<StatCard
				title="Repos"
				value={userStats.summary.totalRepos}
				detail={`${userStats.summary.activeRepos} active`}
				accent={defaultTheme.colors.blue}
				delay={0.24}
			/>
			<StatCard
				title="Pull Requests"
				value={userStats.community.totalPullRequests}
				detail={`${userStats.community.totalPullRequestReviews} reviews`}
				accent={defaultTheme.colors.purple}
				delay={0.36}
			/>
			<StatCard
				title="Languages"
				value={userStats.summary.languageCount}
				detail={userStats.topLanguages[0]?.languageName}
				accent={defaultTheme.colors.red}
				delay={0.48}
			/>
			<StatCard
				title="Repo Views"
				value={userStats.repositories.repoViews}
				detail="14 day traffic"
				accent={defaultTheme.colors.cyan}
				delay={0.6}
			/>
		</div>
	);
}
