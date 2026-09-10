import {useTheme} from '../../themes';

export function EmptyState({title, detail}: {title: string; detail?: string}) {
	const theme = useTheme();
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				flex: 1,
				minWidth: 0,
				padding: '12px 0',
				fontFamily: theme.typography.fontFamily,
			}}
		>
			<p style={{margin: 0, fontSize: 13, color: theme.colors.text}}>{title}</p>
			{detail ? (
				<p
					style={{
						margin: '7px 0 0',
						fontSize: 11,
						lineHeight: 1.6,
						color: theme.colors.muted,
						maxWidth: 320,
					}}
				>
					{detail}
				</p>
			) : null}
		</div>
	);
}
