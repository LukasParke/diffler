import {Theme} from './types';

export const defaultTheme: Theme = {
	colors: {
		background: '#282a36',
		panel: '#30323f',
		panelLight: '#3b3d4d',
		border: '#494b5a',
		text: '#f8f8f2',
		muted: '#b9b8c5',
		faint: '#9796a6',
		green: '#b6d7b9',
		// The five original beam inks; deep blue is a graphic accent, not body text.
		pink: '#FFB7C5',
		yellow: '#FFDDB7',
		purple: '#B1C5FF',
		cyan: '#4FABFF',
		blue: '#076EFF',
		red: '#efb1b1',
	},
	radii: {
		card: '12px',
		panel: '6px',
	},
	typography: {
		fontFamily:
			"'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace",
	},
};
