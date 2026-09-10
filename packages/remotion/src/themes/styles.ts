import {CSSProperties} from 'react';
import {Theme} from './types';

export function themeToCssVariables(
	theme: Theme,
): CSSProperties & Record<`--diffler-${string}`, string> {
	return {
		'--diffler-background': theme.colors.background,
		'--diffler-panel': theme.colors.panel,
		'--diffler-panel-light': theme.colors.panelLight,
		'--diffler-border': theme.colors.border,
		'--diffler-text': theme.colors.text,
		'--diffler-muted': theme.colors.muted,
		'--diffler-faint': theme.colors.faint,
		'--diffler-green': theme.colors.green,
		'--diffler-blue': theme.colors.blue,
		'--diffler-yellow': theme.colors.yellow,
		'--diffler-pink': theme.colors.pink,
		'--diffler-red': theme.colors.red,
		'--diffler-cyan': theme.colors.cyan,
		'--diffler-purple': theme.colors.purple,
		'--diffler-radius-card': theme.radii.card,
		'--diffler-radius-panel': theme.radii.panel,
		'--diffler-font': theme.typography.fontFamily,
	};
}
