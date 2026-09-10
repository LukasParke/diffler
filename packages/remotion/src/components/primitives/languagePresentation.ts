import {RenderLanguage} from '../../data';
import {Theme} from '../../themes';

/** Keep the original deep-blue beam ink out of small, quantitative chart marks. */
export function getLanguageAccent(theme: Theme, index: number): string {
	const palette = [
		theme.colors.purple,
		theme.colors.cyan,
		theme.colors.pink,
		theme.colors.yellow,
		theme.colors.text,
	];
	return palette[index % palette.length];
}

export function getLanguageShare(
	language: RenderLanguage,
	totalBytes: number,
): number {
	const share =
		language.percentage ??
		(totalBytes > 0 ? (language.value / totalBytes) * 100 : 0);
	return Number.isFinite(share) ? Math.max(0, Math.min(100, share)) : 0;
}
