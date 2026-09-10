import {UserStats} from '../../data';
import {useTheme} from '../../themes';
import {formatMetricValue} from './formatMetric';

export type OptionalMetricCoverage = {
	state: 'complete' | 'partial' | 'pending' | 'unavailable' | 'unknown';
	available: boolean;
	completed: number;
	pending: number;
	failed: number;
	label: string;
	detail: string;
};

/** Coverage describes the sampled repositories, not the completeness of the profile. */
export function getOptionalMetricCoverage(
	stats: UserStats,
	metric: 'lines' | 'traffic',
): OptionalMetricCoverage {
	const completed =
		metric === 'lines'
			? stats.code.contributorReposCompleted
			: stats.repositories.trafficReposCompleted;
	const pending =
		metric === 'lines'
			? stats.code.contributorReposPending
			: stats.repositories.trafficReposPending;
	const failed =
		metric === 'lines'
			? stats.code.contributorReposFailed
			: stats.repositories.trafficReposFailed;
	const reportedValue =
		metric === 'lines'
			? Math.max(
					stats.code.linesAdded,
					stats.code.linesDeleted,
					stats.code.linesOfCodeChanged,
				)
			: Math.max(
					stats.repositories.repoViews,
					stats.repositories.repoViewUniques,
				);
	const available = completed > 0 || reportedValue > 0;
	const counts = {completed, pending, failed, available};

	if (completed === 0 && pending === 0 && failed === 0) {
		return {
			...counts,
			state: available ? 'unknown' : 'unavailable',
			label: available ? 'Coverage unknown' : 'Unavailable',
			detail: 'Repository coverage not reported',
		};
	}

	const detail = [
		// Retry queues and retained cache successes may refer to the same repositories.
		`${formatMetricValue(completed)} repos collected`,
		pending > 0 ? `${formatMetricValue(pending)} pending` : '',
		failed > 0 ? `${formatMetricValue(failed)} unavailable` : '',
	]
		.filter(Boolean)
		.join(' · ');

	if (!available) {
		return {
			...counts,
			state: pending > 0 ? 'pending' : 'unavailable',
			label: pending > 0 ? 'Pending' : 'Unavailable',
			detail,
		};
	}
	if (pending > 0 || failed > 0) {
		return {...counts, state: 'partial', label: 'Partial total', detail};
	}
	const coverageKnown = stats.collectionStatus.coverageKnown?.[metric === 'lines' ? 'contributors' : 'traffic'];
	if (coverageKnown === false) {
		return {...counts, state: 'partial', label: 'Partial total', detail: `${detail} · some account coverage unreported`};
	}
	if (!stats.collectionStatus.coreComplete) {
		return {
			...counts,
			state: 'partial',
			label: 'Partial total',
			detail: `${detail} · core collection partial`,
		};
	}
	if (stats.privacy.redactedOptionalMetrics > 0) {
		return {
			...counts,
			state: 'partial',
			label: 'Partial total',
			detail: `${detail} · some optional metrics redacted`,
		};
	}
	return {...counts, state: 'complete', label: 'Collected', detail};
}

export function getCollectionLabel(stats: UserStats): string {
	if (!stats.collectionStatus.coreComplete) return 'Partial core collection';
	if (
		stats.collectionStatus.backfillPending > 0 ||
		stats.code.contributorReposPending > 0 ||
		stats.repositories.trafficReposPending > 0
	)
		return 'Optional metrics pending';
	if (
		stats.collectionStatus.backfillFailedThisRun > 0 ||
		stats.code.contributorReposFailed > 0 ||
		stats.repositories.trafficReposFailed > 0
	)
		return 'Some optional metrics unavailable';
	if (stats.collectionStatus.coverageKnown?.contributors === false ||
		stats.collectionStatus.coverageKnown?.traffic === false) return 'Partial collection';
	if (stats.isComplete && stats.collectionStatus.complete)
		return 'Collection complete';
	return 'Partial collection';
}

export function CollectionNote({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const label = getCollectionLabel(userStats);
	return (
		<p
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 7,
				margin: 0,
				color: theme.colors.muted,
				fontFamily: theme.typography.fontFamily,
				fontSize: 10,
				lineHeight: 1.4,
			}}
		>
			<span
				aria-hidden="true"
				style={{
					height: 3,
					width: 3,
					flexShrink: 0,
					borderRadius: theme.radii.panel,
					backgroundColor: userStats.collectionStatus.coreComplete
						? theme.colors.yellow
						: theme.colors.pink,
				}}
			/>
			{label}
		</p>
	);
}
