import {userStatsSchema, type UserStats} from './schemas';
import {normalizeLanguages} from './adapter';
import {
	calendarStats,
	hasCompleteCalendar,
	mergeCalendars,
	mergeTimelines,
} from './contributions';
import {finalizeUserStats} from './model';
import {mergePackageMetrics} from '@lukasparke/diffler-schemas';

/**
 * Combine distinct profiles without mutating the inputs. Profile identity comes
 * from the first source; generatedAt/fetchedAt are the newest source timestamps,
 * while refreshedAt is the oldest. Counts/bytes/coverage are sums, not deduped
 * repository, person or visitor totals: UserStats carries no such IDs. Language
 * count covers the observed union of names; formatted per-profile cards are not
 * aggregate metrics and are dropped. Calendar days are summed across profiles.
 */
export function mergeUserStats(stats: readonly UserStats[]): UserStats {
	if (stats.length === 0) throw new Error('No GitHub stats were loaded');
	const sources = stats.map((stat) =>
		finalizeUserStats(userStatsSchema.parse(stat)),
	);
	const usernames = sources.map((stat) => stat.username.toLowerCase());
	if (new Set(usernames).size !== usernames.length) {
		throw new Error(
			'Cannot merge multiple snapshots of the same GitHub profile',
		);
	}
	const [first, ...rest] = sources;
	if (rest.length === 0) return first;
	const merged = userStatsSchema.parse(first);

	for (const stat of rest) {
		merged.contributions.totalContributions +=
			stat.contributions.totalContributions;
		merged.contributions.totalCommits += stat.contributions.totalCommits;
		merged.contributions.restrictedContributionsCount +=
			stat.contributions.restrictedContributionsCount;
		for (const key of userStatsSchema.shape.code.keyof().options) {
			merged.code[key] += stat.code[key];
		}
		for (const key of userStatsSchema.shape.community.keyof().options) {
			merged.community[key] += stat.community[key];
		}
		for (const key of userStatsSchema.shape.repositories.keyof().options) {
			merged.repositories[key] += stat.repositories[key];
		}
		merged.collectionStatus.backfillPending +=
			stat.collectionStatus.backfillPending;
		merged.collectionStatus.backfillCompletedThisRun +=
			stat.collectionStatus.backfillCompletedThisRun;
		merged.collectionStatus.backfillFailedThisRun +=
			stat.collectionStatus.backfillFailedThisRun;
		merged.privacy.privateRepositoryDetailsIncluded ||=
			stat.privacy.privateRepositoryDetailsIncluded;
		merged.privacy.privateRepositoryMetricsIncluded ||=
			stat.privacy.privateRepositoryMetricsIncluded;
		merged.privacy.privateCacheDetailsIncluded ||=
			stat.privacy.privateCacheDetailsIncluded;
		merged.privacy.redactedPrivateRepositories +=
			stat.privacy.redactedPrivateRepositories;
		merged.privacy.redactedRepositoryContributions +=
			stat.privacy.redactedRepositoryContributions;
		merged.privacy.redactedOptionalMetrics +=
			stat.privacy.redactedOptionalMetrics;
	}

	merged.schemaVersion = sources.every((stat) => stat.schemaVersion === 2)
		? 2
		: null;
	merged.generatedAt = new Date(
		Math.max(...sources.map((stat) => Date.parse(stat.generatedAt))),
	).toISOString();
	merged.fetchedAt = Math.max(...sources.map((stat) => stat.fetchedAt));
	merged.summary.refreshedAt = new Date(
		Math.min(...sources.map((stat) => Date.parse(stat.summary.refreshedAt))),
	).toISOString();
	merged.topLanguages = normalizeLanguages(
		sources.flatMap((stat) => stat.topLanguages),
		merged.code.codeByteTotal,
	);
	merged.summary.languageCount = merged.topLanguages.length;
	merged.summary.profileMetricsComplete = sources.every((stat) => stat.summary.profileMetricsComplete);
	merged.packages = mergePackageMetrics(sources.map((stat) => stat.packages));
	const calendar = mergeCalendars(
		sources.map((stat) => stat.contributions.calendar),
	);
	merged.contributions = {
		...merged.contributions,
		...calendarStats(calendar, merged.generatedAt),
		calendar,
		timeline: mergeTimelines(
			sources.map((stat) => stat.contributions.timeline),
		),
	};
	merged.cards = [];
	merged.highlights = [];

	const calendarComplete = sources.every((stat) =>
		hasCompleteCalendar(stat.contributions),
	);
	const languagesComplete = sources.every(
		(stat) =>
			stat.summary.languageCount ===
				new Set(stat.topLanguages.map((language) => language.languageName))
					.size &&
			stat.topLanguages.reduce((sum, language) => sum + language.value, 0) ===
				stat.code.codeByteTotal,
	);
	const warnings = sources.flatMap((stat) => stat.collectionStatus.warnings);
	warnings.push(
		'Merged profile totals are additive, not repository/person/visitor-deduplicated.',
	);
	if (!calendarComplete) {
		warnings.push(
			'Merged streaks and peak dates cover only supplied calendars; contribution days are missing.',
		);
	}
	if (!languagesComplete) {
		warnings.push(
			'Merged language count covers only supplied names; omitted languages cannot be deduplicated.',
		);
	}
	merged.isComplete = sources.every((stat) => stat.isComplete);
	merged.collectionStatus = {
		...merged.collectionStatus,
		complete: merged.isComplete,
		coverageKnown: {
			contributors: sources.every((stat) => stat.collectionStatus.coverageKnown?.contributors === true),
			traffic: sources.every((stat) => stat.collectionStatus.coverageKnown?.traffic === true),
		},
		coreComplete:
			sources.every((stat) => stat.collectionStatus.coreComplete) &&
			calendarComplete &&
			languagesComplete,
		warnings: [...new Set(warnings)],
		errors: [
			...new Set(sources.flatMap((stat) => stat.collectionStatus.errors)),
		],
	};

	return finalizeUserStats(merged);
}
