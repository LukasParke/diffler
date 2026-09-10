import {useCurrentFrame, useVideoConfig} from 'remotion';
import {UserStats} from '../data';
import {
	EmptyState,
	formatCodeSize,
	formatMetricValue,
	getLanguageAccent,
	getLanguageShare,
	Panel,
} from '../components/primitives';
import {useTheme} from '../themes';
import {subtleReveal} from '../utils/animation';

export function LanguagesCard({userStats}: {userStats: UserStats}) {
	const theme = useTheme();
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const languages = userStats.topLanguages.slice(0, 8);
	const shares = languages.map((language) =>
		getLanguageShare(language, userStats.code.codeByteTotal),
	);
	const totalShare = shares.reduce((sum, share) => sum + share, 0);
	const otherShare = Math.max(0, 100 - totalShare);
	const scale = totalShare > 100 ? 100 / totalShare : 1;

	return (
		<Panel
			title="Language mix"
			subtitle={`${formatMetricValue(userStats.summary.languageCount)} languages · ${formatCodeSize(userStats.code.codeByteTotal)} indexed`}
			accent={theme.colors.purple}
			footer={
				languages.length > 0 && otherShare > 0.05
					? `Other indexed code · ${otherShare.toFixed(1)}%`
					: undefined
			}
		>
			{languages.length === 0 ? (
				<EmptyState
					title="No language data yet"
					detail="Language shares appear when repository code bytes are collected."
				/>
			) : (
				<>
					<div
						role="img"
						aria-label="Language proportions by code bytes"
						style={{
							display: 'flex',
							height: 6,
							flexShrink: 0,
							width: '100%',
							backgroundColor: theme.colors.panelLight,
							borderRadius: theme.radii.panel,
							overflow: 'hidden',
							marginBottom: 20,
						}}
					>
						{languages.map((language, index) => (
							<div
								key={language.languageName}
								title={`${language.languageName}: ${shares[index].toFixed(1)}%`}
								style={{
									width: `${shares[index] * scale}%`,
									flexShrink: 0,
									backgroundColor: getLanguageAccent(theme, index),
									opacity: subtleReveal(frame, {fps, delay: index * 0.045})
										.opacity,
								}}
							/>
						))}
					</div>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
							gridAutoRows: 'minmax(0, 1fr)',
							columnGap: 28,
							rowGap: 10,
							flex: 1,
							minHeight: 0,
						}}
					>
						{languages.map((language, index) => (
							<div
								key={language.languageName}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 8,
									minWidth: 0,
								}}
							>
								<span
									aria-hidden="true"
									style={{
										width: 3,
										height: 12,
										flexShrink: 0,
										backgroundColor: getLanguageAccent(theme, index),
									}}
								/>
								<span
									title={language.languageName}
									style={{
										fontSize: 11,
										flex: 1,
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
									}}
								>
									{language.languageName}
								</span>
								<span
									style={{
										fontSize: 11,
										flexShrink: 0,
										fontVariantNumeric: 'tabular-nums',
										color: theme.colors.muted,
									}}
								>
									{shares[index].toFixed(1)}%
								</span>
							</div>
						))}
					</div>
				</>
			)}
		</Panel>
	);
}
