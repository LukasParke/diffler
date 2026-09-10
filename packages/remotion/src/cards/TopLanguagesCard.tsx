import {UserStats} from '../data';
import {
	EmptyState,
	formatCodeSize,
	getLanguageAccent,
	Panel,
	ProgressBar,
} from '../components/primitives';
import {useTheme} from '../themes';

export function TopLanguagesCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const languages = userStats.topLanguages.slice(0, 8);
	const maxBytes = Math.max(1, ...languages.map((language) => language.value));

	return (
		<Panel
			compact
			title="Top languages"
			subtitle={`${formatCodeSize(userStats.code.codeByteTotal)} of indexed code`}
			accent={theme.colors.purple}
		>
			{languages.length === 0 ? (
				<EmptyState
					title="No language data yet"
					detail="Repository language bytes have not been collected."
				/>
			) : (
				<div
					style={{
						display: 'grid',
						gridTemplateRows: `repeat(${languages.length}, minmax(0, 1fr))`,
						gap: 2,
						flex: 1,
						minHeight: 0,
					}}
				>
					{languages.map((language, index) => (
						<div
							key={language.languageName}
							style={{
								display: 'grid',
								gridTemplateColumns: 'minmax(0, 144px) minmax(0, 1fr) 80px',
								alignItems: 'center',
								gap: 12,
								minHeight: 0,
							}}
						>
							<div
								style={{
									display: 'flex',
									minWidth: 0,
									alignItems: 'center',
									gap: 8,
								}}
							>
								<span
									aria-hidden="true"
									style={{
										width: 3,
										height: 11,
										flexShrink: 0,
										backgroundColor: getLanguageAccent(theme, index),
									}}
								/>
								<span
									title={language.languageName}
									style={{
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
										fontSize: 11,
										lineHeight: 1.4,
									}}
								>
									{language.languageName}
								</span>
							</div>
							<ProgressBar
								value={language.value}
								max={maxBytes}
								color={getLanguageAccent(theme, index)}
								delaySeconds={index * 0.045}
								height={3}
								label={`${language.languageName} relative to largest language`}
							/>
							<span
								title={`${formatCodeSize(language.value)} of ${formatCodeSize(userStats.code.codeByteTotal)}`}
								style={{
									textAlign: 'right',
									fontSize: 10,
									whiteSpace: 'nowrap',
									fontVariantNumeric: 'tabular-nums',
									color: theme.colors.muted,
								}}
							>
								{formatCodeSize(language.value)}
							</span>
						</div>
					))}
				</div>
			)}
		</Panel>
	);
}
