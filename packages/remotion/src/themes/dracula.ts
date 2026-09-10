import {Theme} from './types';
import {defaultTheme} from './default';

export const draculaTheme: Theme = {
	colors: {
		background: '#282a36',
		panel: '#323442',
		panelLight: '#44475a',
		border: '#525568',
		text: '#f8f8f2',
		muted: '#b7bad0',
		faint: '#9a9daf',
		green: '#50fa7b',
		blue: '#8be9fd',
		yellow: '#f1fa8c',
		pink: '#ff79c6',
		red: '#ff8e8e',
		cyan: '#8be9fd',
		purple: '#bd93f9',
	},
	radii: {...defaultTheme.radii},
	typography: {...defaultTheme.typography},
};
