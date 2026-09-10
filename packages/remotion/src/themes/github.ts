import {Theme} from './types';
import {defaultTheme} from './default';

export const githubTheme: Theme = {
	colors: {
		background: '#0d1117',
		panel: '#161b22',
		panelLight: '#21262d',
		border: '#30363d',
		text: '#f0f3f6',
		muted: '#b1bac4',
		faint: '#8b949e',
		green: '#7ee787',
		blue: '#58a6ff',
		yellow: '#e3b341',
		pink: '#f778ba',
		red: '#ff7b72',
		cyan: '#79c0ff',
		purple: '#d2a8ff',
	},
	radii: {
		card: '8px',
		panel: '4px',
	},
	typography: {...defaultTheme.typography},
};
