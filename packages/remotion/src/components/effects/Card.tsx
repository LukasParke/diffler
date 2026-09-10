import {ReactNode} from 'react';
import {AbsoluteFill} from 'remotion';
import {MainProps} from '../../data';
import {themeToCssVariables, useTheme} from '../../themes';

type CardProps = {
	children: ReactNode;
	userStats: MainProps['userStats'];
};

export function Card({children, userStats}: CardProps) {
	const theme = useTheme();
	if (!userStats) return null;

	return (
		<AbsoluteFill
			data-diffler="card"
			style={{
				...themeToCssVariables(theme),
				boxSizing: 'border-box',
				padding: 4,
				backgroundColor: 'transparent',
				color: theme.colors.text,
				fontFamily: theme.typography.fontFamily,
			}}
		>
			{children}
		</AbsoluteFill>
	);
}
