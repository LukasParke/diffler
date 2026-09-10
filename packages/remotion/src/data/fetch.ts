import {sourcePropsSchema, type SourceProps, type UserStats} from './schemas';
import {normalizeGithubStats, normalizeUserStats} from './adapter';
import {mergeUserStats} from './merge';
import {githubStatsOutputSchema, mergeStatsOutputs} from '@lukasparke/diffler-schemas';
import {finalizeUserStats} from './model';

const statsUrlForUsername = (username: string) =>
	`https://raw.githubusercontent.com/${username}/stats/main/github-user-stats.json`;

/** Validate supplied props and fail at the boundary; never substitute demo data. */
export async function fetchUserStats(input: unknown): Promise<UserStats> {
	const inputProps = sourcePropsSchema.parse(input);
	const options = {
		allowPrivateRepositoryDetails:
			inputProps.allowPrivateRepositoryDetails === true,
	};

	if (inputProps.stats !== undefined) {
		return normalizeGithubStats(inputProps.stats, options);
	}

	const urls = getStatsUrls(inputProps);
	if (urls.length === 0) {
		return normalizeUserStats(inputProps.userStats, options);
	}

	const documents = await Promise.all(
		urls.map(async (url) => {
			const response = await fetch(url, {
				headers: {
					accept: 'application/json',
					'user-agent': 'github-readme-cards',
				},
			});
			if (!response.ok) {
				throw new Error(
					`Failed to fetch stats from ${url}: ${response.status}`,
				);
			}
			const raw: unknown = await response.json();
			return raw;
		}),
	);

	// Validate each document and apply its privacy guard before any merge can strip fields.
	const stats = documents.map((document) => normalizeGithubStats(document, options));
	const canonical = documents.map((document) => githubStatsOutputSchema.safeParse(document));
	if (canonical.every((result) => result.success)) {
		const merged = normalizeGithubStats(mergeStatsOutputs(canonical.map((result) => result.data)), options);
		return finalizeUserStats({
			...merged,
			isComplete: merged.isComplete && stats.every((stat) => stat.isComplete),
			summary: {
				...merged.summary,
				refreshedAt: new Date(Math.min(...stats.map((stat) => Date.parse(stat.summary.refreshedAt)))).toISOString(),
			},
			collectionStatus: {
				...merged.collectionStatus,
				coreComplete: merged.collectionStatus.coreComplete && stats.every((stat) => stat.collectionStatus.coreComplete),
				coverageKnown: {
					contributors: stats.every((stat) => stat.collectionStatus.coverageKnown?.contributors === true),
					traffic: stats.every((stat) => stat.collectionStatus.coverageKnown?.traffic === true),
				},
				warnings: [...new Set([
					...merged.collectionStatus.warnings,
					...stats.flatMap((stat) => stat.collectionStatus.warnings.map((warning) => `[${stat.username}] ${warning}`)),
				])],
			},
		});
	}
	return mergeUserStats(stats);
}

function getStatsUrls(inputProps: SourceProps): string[] {
	if (inputProps.statsUrl !== undefined) return [inputProps.statsUrl];
	const usernames =
		inputProps.usernames ?? (inputProps.username ? [inputProps.username] : []);
	return usernames.map(statsUrlForUsername);
}
