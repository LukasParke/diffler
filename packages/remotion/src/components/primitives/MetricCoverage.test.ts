import {describe, expect, it} from 'vitest';
import {defaultStats} from '../../data/defaultStats';
import {getCollectionLabel, getOptionalMetricCoverage} from './MetricCoverage';

const coreCollected = {
	...defaultStats,
	code: {
		...defaultStats.code,
		contributorReposPending: 0,
		contributorReposFailed: 0,
	},
	repositories: {
		...defaultStats.repositories,
		trafficReposPending: 0,
		trafficReposFailed: 0,
	},
	collectionStatus: {
		...defaultStats.collectionStatus,
		coverageKnown: {contributors: true, traffic: true},
		coreComplete: true,
		backfillPending: 0,
		backfillFailedThisRun: 0,
	},
};

describe('optional metric coverage', () => {
	it.each([
		{completed: 0, pending: 1, failed: 1},
		{completed: 1, pending: 1, failed: 0},
	])('does not sum overlapping retry statuses into a distinct repository denominator: %j', ({completed, pending, failed}) => {
		const stats = {
			...coreCollected,
			repositories: {...coreCollected.repositories, totalRepos: 1},
			code: {...coreCollected.code, contributorReposCompleted: completed, contributorReposPending: pending, contributorReposFailed: failed},
		};
		const coverage = getOptionalMetricCoverage(stats, 'lines');
		expect(coverage.detail).toContain('1 pending');
		expect(coverage.detail).not.toContain('of 2 repos');
	});

	it('does not turn pending line history into a measured zero', () => {
		const stats = {
			...defaultStats,
			code: {
				...defaultStats.code,
				linesAdded: 0,
				linesDeleted: 0,
				linesOfCodeChanged: 0,
				contributorReposCompleted: 0,
				contributorReposPending: 3,
				contributorReposFailed: 0,
			},
		};
		expect(getOptionalMetricCoverage(stats, 'lines')).toMatchObject({
			state: 'pending',
			available: false,
		});
	});

	it('keeps a measured zero when repositories were collected', () => {
		const stats = {
			...defaultStats,
			collectionStatus: {...defaultStats.collectionStatus, coreComplete: true},
			code: {
				...defaultStats.code,
				linesAdded: 0,
				linesDeleted: 0,
				linesOfCodeChanged: 0,
				contributorReposCompleted: 3,
				contributorReposPending: 0,
				contributorReposFailed: 0,
			},
			privacy: {...defaultStats.privacy, redactedOptionalMetrics: 0},
		};
		expect(getOptionalMetricCoverage(stats, 'lines')).toMatchObject({
			state: 'complete',
			available: true,
		});
	});

	it('labels a retained traffic total with no coverage as unknown', () => {
		const stats = {
			...defaultStats,
			repositories: {
				...defaultStats.repositories,
				repoViews: 349,
				trafficReposCompleted: 0,
				trafficReposPending: 0,
				trafficReposFailed: 0,
			},
		};
		expect(getOptionalMetricCoverage(stats, 'traffic')).toMatchObject({
			state: 'unknown',
			available: true,
			label: 'Coverage unknown',
		});
	});

	it('marks an unsuccessful traffic collection unavailable', () => {
		const stats = {
			...defaultStats,
			repositories: {
				...defaultStats.repositories,
				repoViews: 0,
				repoViewUniques: 0,
				trafficReposCompleted: 0,
				trafficReposPending: 0,
				trafficReposFailed: 4,
			},
		};
		expect(getOptionalMetricCoverage(stats, 'traffic')).toMatchObject({
			state: 'unavailable',
			available: false,
		});
	});

	it('identifies partial totals even when some repositories succeeded', () => {
		const stats = {
			...defaultStats,
			code: {
				...defaultStats.code,
				linesAdded: 400,
				contributorReposCompleted: 2,
				contributorReposPending: 1,
				contributorReposFailed: 1,
			},
		};
		expect(getOptionalMetricCoverage(stats, 'lines')).toMatchObject({
			state: 'partial',
			available: true,
			detail: '2 repos collected · 1 pending · 1 unavailable',
		});
	});

	it('does not call an optional sample complete when core collection is partial', () => {
		const stats = {
			...defaultStats,
			collectionStatus: {...defaultStats.collectionStatus, coreComplete: false},
			code: {
				...defaultStats.code,
				contributorReposCompleted: 3,
				contributorReposPending: 0,
			},
		};
		expect(getOptionalMetricCoverage(stats, 'lines').state).toBe('partial');
	});

	it('does not label partial core data as a complete collection', () => {
		const stats = {
			...defaultStats,
			isComplete: true,
			collectionStatus: {
				...defaultStats.collectionStatus,
				complete: true,
				coreComplete: false,
			},
		};
		expect(getCollectionLabel(stats)).toBe('Partial core collection');
	});

	it('does not treat an unreported zero as a completed optional collection', () => {
		const stats = {
			...coreCollected,
			code: {
				...coreCollected.code,
				linesAdded: 0,
				linesDeleted: 0,
				linesOfCodeChanged: 0,
				contributorReposCompleted: 0,
			},
		};
		expect(getOptionalMetricCoverage(stats, 'lines')).toMatchObject({
			state: 'unavailable',
			available: false,
		});
	});

	it('qualifies a total when some optional metrics were redacted', () => {
		const stats = {
			...coreCollected,
			code: {...coreCollected.code, contributorReposCompleted: 3},
			privacy: {...coreCollected.privacy, redactedOptionalMetrics: 1},
		};
		expect(getOptionalMetricCoverage(stats, 'lines')).toMatchObject({
			state: 'partial',
			detail: '3 repos collected · some optional metrics redacted',
		});
	});

	it('does not let a summary flag override a known pending queue', () => {
		const stats = {
			...coreCollected,
			isComplete: true,
			collectionStatus: {...coreCollected.collectionStatus, complete: true},
			repositories: {...coreCollected.repositories, trafficReposPending: 1},
		};
		expect(getCollectionLabel(stats)).toBe('Optional metrics pending');
	});

	it('distinguishes unavailable optional metrics from pending work', () => {
		const stats = {
			...coreCollected,
			code: {...coreCollected.code, contributorReposFailed: 1},
		};
		expect(getCollectionLabel(stats)).toBe('Some optional metrics unavailable');
	});

	it('uses complete only when collection flags and known queues agree', () => {
		const stats = {
			...coreCollected,
			isComplete: true,
			collectionStatus: {...coreCollected.collectionStatus, complete: true},
		};
		expect(getCollectionLabel(stats)).toBe('Collection complete');
	});

	it('keeps an otherwise unconfirmed collection partial', () => {
		const stats = {
			...coreCollected,
			isComplete: false,
			collectionStatus: {...coreCollected.collectionStatus, complete: false},
		};
		expect(getCollectionLabel(stats)).toBe('Partial collection');
	});
});
