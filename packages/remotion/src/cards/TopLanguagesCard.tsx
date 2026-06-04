import {UserStats} from '../data';
import {formatBytes} from '../utils/format';
import {Panel, ProgressBar} from '../components/primitives';
import {defaultTheme} from '../themes/default';

export function TopLanguagesCard({userStats}: {userStats: UserStats}) {
	const languages = userStats.topLanguages.slice(0, 8);
	const maxBytes = Math.max(1, ...languages.map((language) => language.value));
	const accent = languages[0]?.color || defaultTheme.colors.blue;

	return (
		<Panel
			title="Top Languages"
			subtitle={formatBytes(userStats.code.codeByteTotal)}
			accent={accent}
		>
			<div className="space-y-2">
				{languages.map((language, index) => (
					<div
						key={language.languageName}
						className="grid grid-cols-[108px_1fr_78px] items-center gap-3"
					>
						<p className="flex min-w-0 items-center gap-2 text-xs font-semibold">
							<span
								className="size-2 shrink-0 rounded-full"
								style={{backgroundColor: language.color || defaultTheme.colors.blue}}
							/>
							<span className="truncate">{language.languageName}</span>
						</p>
						<ProgressBar
							value={language.value}
							max={maxBytes}
							color={language.color || defaultTheme.colors.blue}
							delay={index * 4}
							height={9}
						/>
						<p className="text-right text-[11px] text-[#8b949e]">
							{formatBytes(language.value)}
						</p>
					</div>
				))}
			</div>
		</Panel>
	);
}
