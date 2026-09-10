import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import {createTheme, defaultTheme, ThemeProvider} from '../../themes';
import {Panel} from './Panel';
import {MetricTile} from './MetricTile';
import {ProgressBar} from './ProgressBar';
import {ContributionTimeline} from './ContributionTimeline';

vi.mock('remotion', async (importOriginal) => ({
	...(await importOriginal<typeof import('remotion')>()),
	useCurrentFrame: () => 0,
	useVideoConfig: () => ({fps: 30}),
}));

const theme = createTheme(defaultTheme, {
	colors: {
		background: '#f4eddd',
		panel: '#eee1c7',
		panelLight: '#ddd0b9',
		text: '#24222b',
		muted: '#57515f',
		border: '#b7a993',
		purple: '#674374',
	},
	radii: {card: '3px', panel: '2px'},
	typography: {fontFamily: 'Test Mono, monospace'},
});

describe('theme rendering', () => {
	it('applies custom surface, typography and radius tokens without a consumer stylesheet', () => {
		const html = renderToStaticMarkup(
			<ThemeProvider theme={theme}>
				<Panel title="Language mix" subtitle="Repository language bytes">
					TypeScript
				</Panel>
			</ThemeProvider>,
		);
		expect(html).toContain('background-color:#f4eddd');
		expect(html).toContain('color:#24222b');
		expect(html).toContain('color:#57515f');
		expect(html).toContain('border-radius:3px');
		expect(html).toContain('font-family:Test Mono, monospace');
	});

	it('resolves a standalone metric from context rather than hard-coded default colors', () => {
		const html = renderToStaticMarkup(
			<ThemeProvider theme={theme}>
				<MetricTile label="Stars" value={1234} />
			</ThemeProvider>,
		);
		expect(html).toContain('background-color:#674374');
		expect(html).toContain('color:#24222b');
		expect(html).toContain('color:#57515f');
		expect(html).toContain('font-family:Test Mono, monospace');
	});

	it('uses theme tokens for both the progress track and the data ink', () => {
		const html = renderToStaticMarkup(
			<ThemeProvider theme={theme}>
				<ProgressBar value={5} max={10} />
			</ThemeProvider>,
		);
		expect(html).toContain('background-color:#ddd0b9');
		expect(html).toContain('background-color:#674374');
		expect(html).toContain('border-radius:2px');
	});

	it('shows the actual proportion on frame zero, even with a delayed reveal', () => {
		const html = renderToStaticMarkup(
			<ProgressBar value={5} max={10} delaySeconds={2} />,
		);
		expect(html).toContain('aria-valuenow="50"');
		expect(html).toContain('width:50%');
	});

	it('does not turn a zero denominator into an invalid meter', () => {
		expect(renderToStaticMarkup(<ProgressBar value={0} max={0} />)).toContain(
			'aria-valuenow="0"',
		);
	});

	it('keeps period totals meaningful before the timeline stroke is revealed', () => {
		const html = renderToStaticMarkup(
			<ContributionTimeline
				points={[
					{period: '2024', contributions: 0},
					{period: '2025', contributions: 500},
				]}
			/>,
		);
		expect(html).toContain('2024: 0 contributions; 2025: 500 contributions');
	});
});
