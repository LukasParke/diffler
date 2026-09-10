import {
	countSchema,
	githubStatsInputSchema,
	legacyLanguageInputSchema,
	userStatsSchema,
	type GitHubStatsV2Input,
	type LegacyStatsInput,
	type RenderLanguage,
	type UserStats,
} from './schemas';
import {
	calculateProfileRepoMetrics,
	emptyPackageMetrics,
	hasPrivateRepositoryDetails,
} from '@lukasparke/diffler-schemas';
import {
	calendarStats,
	calendarTimeline,
	mergeTimelines,
	mostProductiveMonth,
	normalizeCalendar,
} from './contributions';
import {finalizeUserStats} from './model';

export type NormalizeStatsOptions = {allowPrivateRepositoryDetails: boolean};
const publicOnly: NormalizeStatsOptions = {
	allowPrivateRepositoryDetails: false,
};
const publicPrivacy: UserStats['privacy'] = {
	privateRepositoryMetricsIncluded: false,
	privateRepositoryDetailsIncluded: false,
	privateCacheDetailsIncluded: false,
	redactedPrivateRepositories: 0,
	redactedRepositoryContributions: 0,
	redactedOptionalMetrics: 0,
};

/** Validate external JSON before selecting a supported, typed adapter. */
export function normalizeGithubStats(
	rawValue: unknown,
	options: NormalizeStatsOptions = publicOnly,
): UserStats {
	const raw = githubStatsInputSchema.parse(rawValue);
	const includesPrivateDetails = hasPrivateRepositoryDetails(raw);
	assertPublicSafe(includesPrivateDetails, options);

	const stats =
		raw.schemaVersion === 2 ? normalizeV2Stats(raw) : normalizeLegacyStats(raw);
	return finalizeUserStats({
		...stats,
		privacy: {
			...stats.privacy,
			privateRepositoryDetailsIncluded: includesPrivateDetails,
		},
	});
}

/** Already-normalized data has its own explicit boundary, not the legacy path. */
export function normalizeUserStats(
	value: unknown,
	options: NormalizeStatsOptions = publicOnly,
): UserStats {
	const stats = userStatsSchema.parse(value);
	assertPublicSafe(stats.privacy.privateRepositoryDetailsIncluded, options);
	return finalizeUserStats(stats);
}

function normalizeV2Stats(raw: GitHubStatsV2Input): UserStats {
	const profile = raw.profile;
	const contributions = raw.profileContributions;
	const contributionStats = contributions.stats;
	const metrics = raw.repoMetrics;
	const profileMetrics = metrics?.profile ?? (raw.repositories === undefined
		? undefined
		: calculateProfileRepoMetrics(raw.repositories.filter((repo) =>
			raw.privacy?.privateRepositoryMetricsIncluded || !repo.isPrivate,
		), Date.parse(raw.generatedAt)));
	const contributorStats = metrics?.contributorStats;
	const traffic = metrics?.traffic;
	const repoStats = metrics?.repoStats;
	const activity = raw.activity;
	const status = raw.collectionStatus;
	const summary = raw.presentation?.readmeSummary;
	const calendar = normalizeCalendar(
		contributions.contributionCalendar.weeks.flatMap(
			(week) => week.contributionDays,
		),
	);
	const topLanguages = normalizeLanguages(
		profileMetrics?.topLanguages ?? metrics?.topLanguages ?? [],
		profileMetrics?.codeByteTotal ?? metrics?.codeByteTotal ?? 0,
	);
	const warnings = [...(status?.warnings ?? [])];
	if (!profileMetrics) warnings.push('Owned repository scope is unavailable; profile metrics are incomplete.');

	if (!metrics) {
		warnings.push(
			'Repository metrics are missing; repository and language totals are unavailable.',
		);
	}
	if (!activity) {
		warnings.push('Activity metrics are missing.');
	}
	if (!status) {
		warnings.push('Collection status is missing; completeness is unknown.');
	}
	if (!contributorStats) {
		warnings.push(
			'Contributor metrics are missing; line-change coverage is unknown.',
		);
	}
	if (!traffic) {
		warnings.push('Traffic metrics are missing; view coverage is unknown.');
	}
	if (
		!contributions.completeness.complete ||
		contributions.completeness.missingYears.length > 0
	) {
		warnings.push(
			`Contribution history is incomplete; missing years: ${contributions.completeness.missingYears.join(', ') || 'unknown'}.`,
		);
	}
	const coreComplete =
		status?.coreComplete === true &&
		contributions.completeness.complete &&
		contributions.completeness.missingYears.length === 0 &&
		metrics !== undefined &&
		profileMetrics !== undefined &&
		activity !== undefined;
	const isComplete =
		coreComplete &&
		status?.complete === true &&
		summary?.complete !== false &&
		contributorStats !== undefined &&
		traffic !== undefined;
	const linesOfCodeChanged = contributorStats?.linesOfCodeChanged ?? 0;

	return finalizeUserStats({
		schemaVersion: 2,
		name: profile.name || profile.login,
		username: profile.login,
		avatarUrl: profile.avatarUrl,
		bio: profile.bio,
		websiteUrl: profile.websiteUrl,
		location: profile.location,
		generatedAt: raw.generatedAt,
		fetchedAt: Date.parse(raw.generatedAt),
		isComplete,
		summary: {
			totalContributions: contributions.totalContributions,
			currentStreak: contributionStats.currentStreak,
			longestStreak: contributionStats.longestStreak,
			starsReceived: profileMetrics?.starsReceived ?? metrics?.starCount ?? 0,
			forksReceived: profileMetrics?.forksReceived ?? metrics?.forkCount ?? 0,
			activeRepos: profileMetrics?.activeOriginalRepos ?? repoStats?.activeRepos ?? 0,
			totalRepos: profileMetrics?.totalRepos ?? profileMetrics?.publicRepos ?? repoStats?.totalRepos ?? 0,
			languageCount: topLanguages.length,
			profileMetricsComplete: profileMetrics !== undefined,
			refreshedAt: raw.generatedAt,
		},
		contributions: {
			totalContributions: contributions.totalContributions,
			// Profile commits include private/restricted history; optional repo backfill does not.
			totalCommits: contributions.totalCommitContributions,
			restrictedContributionsCount: contributions.restrictedContributionsCount,
			currentStreak: contributionStats.currentStreak,
			longestStreak: contributionStats.longestStreak,
			peakDay: contributionStats.peakDay,
			mostProductiveMonth: mostProductiveMonth(
				contributionStats.monthlyBreakdown,
			),
			calendar,
			timeline: mergeTimelines([
				contributionStats.yearlyBreakdown.map((year) => ({
					period: year.year,
					contributions: year.contributions,
				})),
			]),
		},
		code: {
			codeByteTotal: profileMetrics?.codeByteTotal ?? metrics?.codeByteTotal ?? 0,
			linesAdded: contributorStats?.linesAdded ?? 0,
			linesDeleted: contributorStats?.linesDeleted ?? 0,
			linesChanged: linesOfCodeChanged,
			linesOfCodeChanged,
			contributorReposCompleted: contributorStats?.reposCompleted ?? 0,
			contributorReposPending: contributorStats?.reposPending ?? 0,
			contributorReposFailed: contributorStats?.reposFailed ?? 0,
		},
		community: {
			totalPullRequests: activity?.totalPullRequests ?? 0,
			totalPullRequestReviews:
				contributions.totalPullRequestReviewContributions,
			openIssues: activity?.openIssues ?? 0,
			closedIssues: activity?.closedIssues ?? 0,
			repositoriesContributedTo: activity?.repositoriesContributedTo ?? 0,
			discussionsStarted: activity?.discussionsStarted ?? 0,
			discussionsAnswered: activity?.discussionsAnswered ?? 0,
			starsGiven: activity?.starsGiven ?? 0,
			followers: profile.followers,
			following: profile.following,
		},
		repositories: {
			totalRepos: profileMetrics?.totalRepos ?? profileMetrics?.publicRepos ?? repoStats?.totalRepos ?? 0,
			publicRepos: profileMetrics?.publicRepos ?? repoStats?.publicRepos ?? 0,
			privateRepos: profileMetrics ? profileMetrics.privateRepos ?? 0 : repoStats?.privateRepos ?? 0,
			activeRepos: profileMetrics?.activeOriginalRepos ?? repoStats?.activeRepos ?? 0,
			archivedRepos: profileMetrics?.archivedOriginalRepos ?? repoStats?.archivedRepos ?? 0,
			forkedRepos: profileMetrics?.forkedRepos ?? repoStats?.forkedRepos ?? 0,
			originalRepos: profileMetrics?.originalRepos ?? repoStats?.originalRepos ?? 0,
			reposWithStars: profileMetrics?.reposWithStars ?? repoStats?.reposWithStars ?? 0,
			repoViews: traffic?.repoViews ?? 0,
			repoViewUniques: traffic?.repoViewUniques ?? 0,
			trafficReposCompleted: traffic?.reposCompleted ?? 0,
			trafficReposPending: traffic?.reposPending ?? 0,
			trafficReposFailed: traffic?.reposFailed ?? 0,
			starCount: profileMetrics?.starsReceived ?? metrics?.starCount ?? 0,
			forkCount: profileMetrics?.forksReceived ?? metrics?.forkCount ?? 0,
		},
		topLanguages,
		packages: raw.packageMetrics ?? emptyPackageMetrics(),
		cards: raw.presentation?.cards ?? [],
		highlights: raw.presentation?.highlights ?? [],
		privacy: raw.privacy ?? publicPrivacy,
		collectionStatus: {
			complete: isComplete,
			coreComplete,
			backfillPending: status?.backfill.pending ?? 0,
			backfillCompletedThisRun: status?.backfill.completedThisRun ?? 0,
			backfillFailedThisRun: status?.backfill.failedThisRun ?? 0,
			warnings,
			errors: status?.errors ?? [],
		},
	});
}

function normalizeLegacyStats(raw: LegacyStatsInput): UserStats {
	const generatedAt = new Date(raw.fetchedAt).toISOString();
	const calendar = normalizeCalendar(
		raw.contributionsCollection?.contributionCalendar.weeks.flatMap(
			(week) => week.contributionDays,
		) ?? [],
	);
	const derived = calendarStats(calendar, generatedAt);
	const contributionStats = raw.contributionStats;
	const repoValue = (key: keyof NonNullable<LegacyStatsInput['repoStats']>) =>
		raw.repoStats?.[key] ?? raw.computedStats?.[key];
	const codeByteTotal =
		raw.codeByteTotal ??
		raw.topLanguages?.reduce((sum, language) => sum + language.value, 0) ??
		0;
	const topLanguages = normalizeLanguages(
		raw.topLanguages ?? [],
		codeByteTotal,
	);
	const linesAdded = raw.linesAdded ?? 0;
	const linesDeleted = raw.linesDeleted ?? 0;
	const linesOfCodeChanged =
		raw.linesOfCodeChanged ?? raw.linesChanged ?? linesAdded + linesDeleted;
	const currentStreak =
		contributionStats?.currentStreak ?? derived.currentStreak;
	const longestStreak =
		contributionStats?.longestStreak ?? derived.longestStreak;

	return finalizeUserStats({
		schemaVersion: null,
		name: raw.name || raw.username,
		username: raw.username,
		avatarUrl: raw.avatarUrl ?? '',
		bio: raw.bio ?? null,
		websiteUrl: raw.websiteUrl ?? null,
		location: raw.location ?? null,
		generatedAt,
		fetchedAt: raw.fetchedAt,
		isComplete: false,
		summary: {
			totalContributions: raw.totalContributions,
			currentStreak,
			longestStreak,
			starsReceived: raw.starCount ?? 0,
			forksReceived: raw.forkCount ?? 0,
			activeRepos: repoValue('activeRepos') ?? 0,
			totalRepos: repoValue('totalRepos') ?? raw.totalRepos ?? 0,
			languageCount: Math.max(
				raw.computedStats?.languageCount ?? 0,
				topLanguages.length,
			),
			profileMetricsComplete: false,
			refreshedAt: generatedAt,
		},
		contributions: {
			totalContributions: raw.totalContributions,
			totalCommits:
				raw.contributionsCollection?.totalCommitContributions ??
				raw.totalCommits ??
				raw.commitCount ??
				0,
			restrictedContributionsCount:
				raw.contributionsCollection?.restrictedContributionsCount ?? 0,
			currentStreak,
			longestStreak,
			peakDay:
				contributionStats?.peakDay === undefined
					? derived.peakDay
					: contributionStats.peakDay,
			mostProductiveMonth: contributionStats?.monthlyBreakdown
				? mostProductiveMonth(contributionStats.monthlyBreakdown)
				: (raw.computedStats?.mostProductiveMonth ??
					derived.mostProductiveMonth),
			calendar,
			timeline: contributionStats?.yearlyBreakdown
				? mergeTimelines([
						contributionStats.yearlyBreakdown.map((year) => ({
							period: year.year,
							contributions: year.contributions,
						})),
					])
				: calendarTimeline(calendar),
		},
		code: {
			codeByteTotal,
			linesAdded,
			linesDeleted,
			linesChanged: linesOfCodeChanged,
			linesOfCodeChanged,
			contributorReposCompleted: 0,
			contributorReposPending: 0,
			contributorReposFailed: 0,
		},
		community: {
			totalPullRequests: raw.totalPullRequests ?? 0,
			totalPullRequestReviews:
				raw.contributionsCollection?.totalPullRequestReviewContributions ??
				raw.totalPullRequestReviews ??
				0,
			openIssues: raw.openIssues ?? 0,
			closedIssues: raw.closedIssues ?? 0,
			repositoriesContributedTo: raw.repositoriesContributedTo ?? 0,
			discussionsStarted: raw.discussionsStarted ?? 0,
			discussionsAnswered: raw.discussionsAnswered ?? 0,
			starsGiven: raw.starsGiven ?? 0,
			followers: raw.followers ?? 0,
			following: raw.following ?? 0,
		},
		repositories: {
			totalRepos: repoValue('totalRepos') ?? raw.totalRepos ?? 0,
			publicRepos: repoValue('publicRepos') ?? 0,
			privateRepos: repoValue('privateRepos') ?? 0,
			activeRepos: repoValue('activeRepos') ?? 0,
			archivedRepos: repoValue('archivedRepos') ?? 0,
			forkedRepos: repoValue('forkedRepos') ?? 0,
			originalRepos: repoValue('originalRepos') ?? 0,
			reposWithStars: repoValue('reposWithStars') ?? 0,
			repoViews: raw.repoViews ?? 0,
			repoViewUniques: 0,
			trafficReposCompleted: 0,
			trafficReposPending: 0,
			trafficReposFailed: 0,
			starCount: raw.starCount ?? 0,
			forkCount: raw.forkCount ?? 0,
		},
		topLanguages,
		packages: raw.packageMetrics ?? emptyPackageMetrics(),
		cards: [],
		highlights: [],
		privacy: raw.privacy ?? publicPrivacy,
		collectionStatus: {
			complete: false,
			coreComplete: false,
			backfillPending: 0,
			backfillCompletedThisRun: 0,
			backfillFailedThisRun: 0,
			warnings: [
				'Legacy stats do not report collection or optional-metric coverage.',
			],
			errors: [],
		},
	});
}

/** Percentages always use the combined byte total, including non-overlapping languages. */
export function normalizeLanguages(
	value: unknown,
	totalBytes: number,
): RenderLanguage[] {
	const languages = legacyLanguageInputSchema.array().parse(value);
	const bytes = countSchema.parse(totalBytes);
	const byName = new Map<string, RenderLanguage>();
	for (const language of languages) {
		const current = byName.get(language.languageName);
		byName.set(language.languageName, {
			languageName: language.languageName,
			color: current?.color ?? language.color,
			value: (current?.value ?? 0) + language.value,
		});
	}
	const observedBytes = [...byName.values()].reduce(
		(sum, language) => sum + language.value,
		0,
	);
	if (observedBytes > bytes) {
		throw new Error('Language bytes exceed codeByteTotal');
	}
	return [...byName.values()]
		.filter((language) => language.value > 0)
		.map((language) => ({
			...language,
			percentage: bytes > 0 ? (language.value / bytes) * 100 : 0,
		}))
		.sort(
			(a, b) =>
				b.value - a.value || a.languageName.localeCompare(b.languageName),
		);
}

function assertPublicSafe(
	includesPrivateDetails: boolean,
	options: NormalizeStatsOptions,
): void {
	if (
		includesPrivateDetails &&
		options.allowPrivateRepositoryDetails !== true
	) {
		throw new Error(
			'Stats JSON includes private repository details. Refusing to render public profile assets.',
		);
	}
}
