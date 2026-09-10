import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {defaultStats} from '../data/defaultStats';
import {StatsCard} from './StatsCard';
import {CodeMetricsCard} from './CodeMetricsCard';
import {CommitStreakCard} from './CommitStreakCard';
import {LanguagesCard} from './LanguagesCard';
import {TopLanguagesCard} from './TopLanguagesCard';

const clock = vi.hoisted(() => ({frame: 0, fps: 30}));
vi.mock('remotion', async (importOriginal) => ({
	...(await importOriginal<typeof import('remotion')>()),
	useCurrentFrame: () => clock.frame,
	useVideoConfig: () => ({fps: clock.fps}),
}));

beforeEach(() => {
	clock.frame = 0;
	clock.fps = 30;
});

describe('supporting cards', () => {
	it('shows the canonical profile commit count, not a repository-backfill alias', () => {
		const stats = {
			...defaultStats,
			totalCommits: 999000,
			contributions: {...defaultStats.contributions, totalCommits: 42},
		};
		expect(renderToStaticMarkup(<StatsCard userStats={stats} />)).toContain(
			'aria-label="Profile commits: 42"',
		);
	});

	it('does not substitute all repositories for a legitimate zero public count', () => {
		const stats = {
			...defaultStats,
			repositories: {
				...defaultStats.repositories,
				publicRepos: 0,
				totalRepos: 12,
				privateRepos: 12,
			},
		};
		expect(renderToStaticMarkup(<StatsCard userStats={stats} />)).toContain(
			'aria-label="Public repositories: 0"',
		);
	});

	it('labels an incomplete core collection honestly', () => {
		const stats = {
			...defaultStats,
			isComplete: false,
			collectionStatus: {...defaultStats.collectionStatus, coreComplete: false},
		};
		expect(renderToStaticMarkup(<StatsCard userStats={stats} />)).toContain(
			'Partial core collection',
		);
	});

	it('shows pending line metrics as unavailable values, not fabricated zeroes', () => {
		const stats = {
			...defaultStats,
			code: {
				...defaultStats.code,
				linesAdded: 0,
				linesDeleted: 0,
				linesOfCodeChanged: 0,
				contributorReposCompleted: 0,
				contributorReposPending: 12,
				contributorReposFailed: 0,
			},
		};
		const html = renderToStaticMarkup(<CodeMetricsCard userStats={stats} />);
		expect(html).toContain('aria-label="Lines changed: —"');
		expect(html).toContain('pending');
	});

	it('does not invent a one-day longest streak for an empty history', () => {
		const stats = {
			...defaultStats,
			contributions: {
				...defaultStats.contributions,
				currentStreak: 0,
				longestStreak: 0,
			},
		};
		expect(
			renderToStaticMarkup(<CommitStreakCard userStats={stats} />),
		).toContain('No streak recorded');
	});

	it('keeps all eight language entries rather than silently dropping the last two', () => {
		const languages = Array.from({length: 8}, (_, index) => ({
			languageName: `Language ${index + 1}`,
			color: null,
			value: 1024,
			percentage: 12.5,
		}));
		const stats = {
			...defaultStats,
			topLanguages: languages,
			summary: {...defaultStats.summary, languageCount: 8},
			code: {...defaultStats.code, codeByteTotal: 8192},
		};
		const html = renderToStaticMarkup(<LanguagesCard userStats={stats} />);
		expect(html).toContain('Language 8');
		expect(html.match(/>12\.5%<\/span>/g)).toHaveLength(8);
	});

	it('does not assign a fake minimum percentage to a tiny language', () => {
		const stats = {
			...defaultStats,
			topLanguages: [
				{languageName: 'Smalltalk', color: null, value: 1, percentage: 0.01},
			],
		};
		expect(renderToStaticMarkup(<LanguagesCard userStats={stats} />)).toContain(
			'width:0.01%',
		);
	});

	it('renders an explanatory empty language state', () => {
		const stats = {...defaultStats, topLanguages: []};
		expect(
			renderToStaticMarkup(<TopLanguagesCard userStats={stats} />),
		).toContain('No language data yet');
	});

	it('retains a long identity in the accessible text while fitting it into the header', () => {
		const username = 'a-long-personal-github-handle-without-layout-overflow';
		const html = renderToStaticMarkup(
			<StatsCard userStats={{...defaultStats, username}} />,
		);
		expect(html).toContain(`title="@${username}"`);
	});
});
