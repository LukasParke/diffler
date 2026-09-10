import {userStatsSchema, type UserStats} from './schemas';
import {hasCompleteCalendar} from './contributions';

function metricAliases(
	stats: Pick<
		UserStats,
		'contributions' | 'code' | 'community' | 'repositories'
	>,
) {
	return {
		repoViews: stats.repositories.repoViews,
		linesOfCodeChanged: stats.code.linesOfCodeChanged,
		linesAdded: stats.code.linesAdded,
		linesDeleted: stats.code.linesDeleted,
		linesChanged: stats.code.linesOfCodeChanged,
		totalCommits: stats.contributions.totalCommits,
		totalPullRequests: stats.community.totalPullRequests,
		totalPullRequestReviews: stats.community.totalPullRequestReviews,
		openIssues: stats.community.openIssues,
		closedIssues: stats.community.closedIssues,
		forkCount: stats.repositories.forkCount,
		starCount: stats.repositories.starCount,
		totalContributions: stats.contributions.totalContributions,
		codeByteTotal: stats.code.codeByteTotal,
	};
}

type UserStatsCore = Omit<UserStats, keyof ReturnType<typeof metricAliases>>;

/** Keep aliases and readiness consistent at every data entry/merge path. */
export function finalizeUserStats(stats: UserStatsCore): UserStats {
	const warnings = [...stats.collectionStatus.warnings];
	const calendarComplete = hasCompleteCalendar(stats.contributions);
	const observedLanguageCount = new Set(
		stats.topLanguages.map((language) => language.languageName),
	).size;
	const languageCount = Math.max(
		stats.summary.languageCount,
		observedLanguageCount,
	);
	const languageBytes = stats.topLanguages.reduce(
		(sum, language) => sum + language.value,
		0,
	);
	if (languageBytes > stats.code.codeByteTotal) {
		throw new Error('Language bytes exceed codeByteTotal');
	}
	const languagesComplete =
		languageBytes === stats.code.codeByteTotal &&
		languageCount === observedLanguageCount;
	if (!calendarComplete) {
		warnings.push('Contribution calendar does not cover the reported total.');
	}
	if (!languagesComplete) {
		warnings.push('Language data does not cover the reported totals.');
	}
	const contributorCoverageUnknown =
		stats.repositories.totalRepos > 0 &&
		stats.code.contributorReposCompleted === 0 &&
		stats.code.contributorReposPending === 0 &&
		stats.code.contributorReposFailed === 0;
	const trafficCoverageUnknown =
		stats.repositories.totalRepos > 0 &&
		stats.repositories.trafficReposCompleted === 0 &&
		stats.repositories.trafficReposPending === 0 &&
		stats.repositories.trafficReposFailed === 0;

	if (contributorCoverageUnknown) {
		warnings.push('Contributor metrics have no completed repository coverage.');
	}
	if (trafficCoverageUnknown) {
		warnings.push('Traffic metrics have no completed repository coverage.');
	}

	const coreComplete =
		stats.collectionStatus.coreComplete &&
		stats.summary.profileMetricsComplete &&
		calendarComplete &&
		languagesComplete;
	const isComplete =
		stats.isComplete &&
		stats.collectionStatus.complete &&
		stats.packages.complete &&
		coreComplete &&
		stats.collectionStatus.errors.length === 0 &&
		stats.collectionStatus.backfillPending === 0 &&
		stats.collectionStatus.backfillFailedThisRun === 0 &&
		stats.code.contributorReposPending === 0 &&
		stats.code.contributorReposFailed === 0 &&
		stats.repositories.trafficReposPending === 0 &&
		stats.repositories.trafficReposFailed === 0 &&
		!contributorCoverageUnknown &&
		!trafficCoverageUnknown;

	return userStatsSchema.parse({
		...stats,
		...metricAliases(stats),
		isComplete,
		summary: {
			...stats.summary,
			totalContributions: stats.contributions.totalContributions,
			currentStreak: stats.contributions.currentStreak,
			longestStreak: stats.contributions.longestStreak,
			starsReceived: stats.repositories.starCount,
			forksReceived: stats.repositories.forkCount,
			activeRepos: stats.repositories.activeRepos,
			totalRepos: stats.repositories.totalRepos,
			languageCount,
		},
		code: {...stats.code, linesChanged: stats.code.linesOfCodeChanged},
		collectionStatus: {
			...stats.collectionStatus,
			complete: isComplete,
			coreComplete,
			warnings: [...new Set(warnings)],
		},
	});
}
