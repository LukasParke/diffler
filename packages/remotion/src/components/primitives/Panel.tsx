import {CSSProperties, ReactNode} from 'react';
import {themeToCssVariables, useTheme} from '../../themes';

type PanelProps = {
	title?: string;
	subtitle?: string;
	children: ReactNode;
	className?: string;
	accent?: string;
	compact?: boolean;
	footer?: ReactNode;
	style?: CSSProperties;
};

export function Panel({
	title,
	subtitle,
	children,
	className = '',
	accent,
	compact = false,
	footer,
	style,
}: PanelProps) {
	const theme = useTheme();

	return (
		<section
			data-diffler="panel"
			className={className}
			aria-label={title}
			style={{
				...themeToCssVariables(theme),
				position: 'relative',
				display: 'flex',
				flexDirection: 'column',
				boxSizing: 'border-box',
				height: '100%',
				width: '100%',
				minWidth: 0,
				minHeight: 0,
				overflow: 'hidden',
				padding: compact ? 16 : 20,
				border: `1px solid ${theme.colors.border}`,
				borderRadius: theme.radii.card,
				backgroundColor: theme.colors.background,
				color: theme.colors.text,
				fontFamily: theme.typography.fontFamily,
				fontSize: 12,
				lineHeight: 1.45,
				...style,
			}}
		>
			{title || subtitle ? (
				<header
					style={{flexShrink: 0, minWidth: 0, marginBottom: compact ? 12 : 16}}
				>
					{title ? (
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 10,
								minWidth: 0,
							}}
						>
							<span
								aria-hidden="true"
								style={{
									width: 16,
									height: 2,
									flexShrink: 0,
									backgroundColor: accent ?? theme.colors.purple,
								}}
							/>
							<h2
								style={{
									margin: 0,
									minWidth: 0,
									fontSize: 18,
									fontWeight: 500,
									lineHeight: 1.3,
									letterSpacing: '-0.5px',
									overflowWrap: 'anywhere',
								}}
							>
								{title}
							</h2>
						</div>
					) : null}
					{subtitle ? (
						<p
							title={subtitle}
							style={{
								margin: '5px 0 0',
								fontSize: 11,
								color: theme.colors.muted,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							}}
						>
							{subtitle}
						</p>
					) : null}
				</header>
			) : null}
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
					minHeight: 0,
					minWidth: 0,
				}}
			>
				{children}
			</div>
			{footer ? (
				<footer
					style={{
						flexShrink: 0,
						marginTop: 12,
						color: theme.colors.muted,
						fontSize: 10,
						lineHeight: 1.4,
						overflowWrap: 'anywhere',
					}}
				>
					{footer}
				</footer>
			) : null}
		</section>
	);
}
