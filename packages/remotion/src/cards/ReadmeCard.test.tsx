import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {defaultStats} from '../data/defaultStats';
import {createTheme, defaultTheme, ThemeProvider} from '../themes';
import {ReadmeCard, ReadmeClassicCard, ReadmeSpotlightCard} from './ReadmeCard';

const clock = vi.hoisted(() => ({frame: 250}));

vi.mock('remotion', async (importOriginal) => ({
	...(await importOriginal<typeof import('remotion')>()),
	useCurrentFrame: () => clock.frame,
	useVideoConfig: () => ({fps: 30, durationInFrames: 300}),
}));

beforeEach(() => {
	clock.frame = 250;
});

describe('profile compositions', () => {
	it('keeps the classic personal greeting and original nine-row structure', () => {
		const html = renderToStaticMarkup(
			<ReadmeClassicCard userStats={defaultStats} />,
		);
		expect(html).toContain('Demo Profile');
		expect(html.match(/role="group"/g)).toHaveLength(9);
		expect(html).toContain('Repo views (2 wks):');
		expect(html).toContain('Open issues:');
		expect(html).not.toContain('telemetry');
	});

	it('uses canonical profile commits rather than a legacy alias', () => {
		const stats = {
			...defaultStats,
			contributions: {...defaultStats.contributions, totalCommits: 9876},
		};
		const html = renderToStaticMarkup(<ReadmeCard userStats={stats} />);
		expect(html).toContain('aria-label="Commits: 9,876"');
	});

	it('does not present pending line backfill as a measured zero', () => {
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
		const html = renderToStaticMarkup(<ReadmeClassicCard userStats={stats} />);
		expect(html).toMatch(/Lines of code changed:.*?Pending/);
	});

	it('provides an offline avatar fallback without guessing a remote URL', () => {
		const stats = {...defaultStats, name: 'Ada Lovelace', avatarUrl: ''};
		const html = renderToStaticMarkup(<ReadmeCard userStats={stats} />);
		expect(html).toContain('Ada Lovelace&#x27;s initials');
		expect(html).toContain('>AL</div>');
		expect(html).not.toContain('<img');
	});

	it('preserves the full identity in accessible text when the display name is long', () => {
		const name = 'A deliberately long display name with several family names';
		const html = renderToStaticMarkup(
			<ReadmeCard userStats={{...defaultStats, name}} />,
		);
		expect(html).toContain(`title="Hi, I&#x27;m ${name}"`);
	});

	it('uses consumer surface, typography, radius, and beam tokens', () => {
		const theme = createTheme(defaultTheme, {
			colors: {background: '#f4eddd', text: '#24222b', pink: '#994466'},
			radii: {card: '4px'},
			typography: {fontFamily: 'Custom Mono, monospace'},
		});
		const html = renderToStaticMarkup(
			<ThemeProvider theme={theme}>
				<ReadmeCard userStats={defaultStats} />
			</ThemeProvider>,
		);
		expect(html).toContain('background-color:#f4eddd');
		expect(html).toContain('color:#24222b');
		expect(html).toContain('border-radius:4px');
		expect(html).toContain('font-family:Custom Mono, monospace');
		expect(html).toContain('stroke="#994466"');
	});

	it('keeps signature foreground text unchanged throughout its ambient loop', () => {
		clock.frame = 0;
		const first = renderToStaticMarkup(
			<ReadmeCard userStats={defaultStats} />,
		).replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, '');
		clock.frame = 299;
		const last = renderToStaticMarkup(
			<ReadmeCard userStats={defaultStats} />,
		).replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, '');
		expect(last).toBe(first);
	});

	it('handles a sparse profile without inventing languages or producing invalid CSS', () => {
		const stats = {
			...defaultStats,
			topLanguages: [],
			code: {...defaultStats.code, codeByteTotal: 0},
			summary: {
				...defaultStats.summary,
				totalContributions: 0,
				languageCount: 0,
			},
		};
		const html = renderToStaticMarkup(
			<ReadmeSpotlightCard userStats={stats} />,
		);
		expect(html).toContain('contributions across GitHub');
		expect(html).not.toMatch(/NaN|Infinity|TypeScript/);
	});
});
