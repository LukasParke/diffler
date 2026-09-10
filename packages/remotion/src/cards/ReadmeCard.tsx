import {
	ArrowDownFromLine,
	ArrowUpFromLine,
	BookOpen,
	Diff,
	GitCommitHorizontal,
	GitFork,
	GitPullRequest,
	HandHeart,
	LucideIcon,
	Sparkles,
	Telescope,
} from 'lucide-react';
import {CSSProperties} from 'react';
import {Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {GeminiBeams} from '../components/effects/GeminiBeams';
import {MetricRow, Panel} from '../components/primitives';
import {
	CollectionNote,
	getOptionalMetricCoverage,
} from '../components/primitives/MetricCoverage';
import {MetricValue} from '../components/primitives/MetricValue';
import {formatMetricValue} from '../components/primitives/formatMetric';
import {getLanguageShare} from '../components/primitives/languagePresentation';
import {UserStats} from '../data';
import {useTheme} from '../themes';
import {interpolateFactory} from '../utils/animation';
import {formatInteger} from '../utils/format';

type ReadmeVariantProps = {userStats: UserStats};
type ProfileMetric = {
	id: string;
	label: string;
	value: number | string;
	icon: LucideIcon;
};

export function ReadmeCard({userStats}: ReadmeVariantProps) {
	const theme = useTheme();
	const metrics = profileMetrics(userStats).filter((metric) =>
		[
			'stars',
			'forks',
			'commits',
			'pull-requests',
			'closed-issues',
			'contributions',
		].includes(metric.id),
	);
	metrics.splice(metrics.length - 1, 0, {
		id: 'repositories',
		label: 'Public repositories',
		value: userStats.repositories.publicRepos,
		icon: BookOpen,
	});

	return (
		<Panel className="diffler-profile" style={{padding: 24}}>
			<GeminiBeams
				rotate={-78}
				scale={1.55}
				opacity={0.86}
				style={{top: 40, bottom: -20, left: '14%', right: '-14%'}}
			/>
			<div
				style={{
					position: 'relative',
					zIndex: 1,
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
					minHeight: 0,
				}}
			>
				<ProfileIdentity userStats={userStats} />
				<div style={{display: 'grid', gridAutoRows: '28px', marginTop: 22}}>
					{metrics.map((metric) => (
						<MetricRow
							key={metric.id}
							icon={<metric.icon size={17} strokeWidth={1.5} />}
							label={metric.label}
							value={formatMetricValue(metric.value)}
							accent={theme.colors.muted}
							labelStyle={{fontSize: 14}}
							style={{padding: 0}}
						/>
					))}
				</div>
				<div style={{marginTop: 'auto', paddingTop: 16}}>
					<LanguageSignature userStats={userStats} />
					<div style={{marginTop: 9}}>
						<CollectionNote userStats={userStats} />
					</div>
				</div>
			</div>
		</Panel>
	);
}

export function ReadmeClassicCard({userStats}: ReadmeVariantProps) {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const theme = useTheme();

	return (
		<Panel className="diffler-profile" style={{padding: 12, border: 'none'}}>
			<GeminiBeams mode="draw" rotate={-105} scale={1.5} style={{top: 144}} />
			<div style={{position: 'relative', zIndex: 1, minWidth: 0}}>
				<ProfileIdentity classic userStats={userStats} />
				<div
					style={{
						display: 'grid',
						gridAutoRows: '20px',
						rowGap: 8,
						marginTop: 16,
					}}
				>
					{profileMetrics(userStats).map((metric, index) => (
						<MetricRow
							key={metric.id}
							icon={<metric.icon size={20} strokeWidth={1.75} />}
							label={`${metric.label}:`}
							value={
								typeof metric.value === 'number'
									? formatInteger(metric.value)
									: metric.value
							}
							accent={theme.colors.text}
							labelStyle={{fontSize: 14, lineHeight: '20px'}}
							valueStyle={{
								fontSize: 14,
								fontWeight: 400,
								letterSpacing: 0,
								lineHeight: '20px',
							}}
							style={{
								padding: 0,
								opacity: interpolateFactory(frame, index / 5, 1, 1, fps),
							}}
						/>
					))}
				</div>
				{!userStats.collectionStatus.coreComplete && (
					<div style={{marginTop: 5}}>
						<CollectionNote userStats={userStats} />
					</div>
				)}
			</div>
		</Panel>
	);
}

export function ReadmeSpotlightCard({userStats}: ReadmeVariantProps) {
	const theme = useTheme();
	const metrics = profileMetrics(userStats).filter((metric) =>
		['stars', 'forks', 'commits', 'pull-requests'].includes(metric.id),
	);

	return (
		<Panel className="diffler-profile" style={{padding: 28}}>
			<GeminiBeams
				rotate={-82}
				scale={1.7}
				style={{left: '23%', right: '-23%', top: -35, bottom: -10}}
			/>
			<div
				style={{
					position: 'relative',
					zIndex: 1,
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
					minHeight: 0,
				}}
			>
				<ProfileIdentity userStats={userStats} />
				<div style={{marginTop: 42, maxWidth: '76%'}}>
					<MetricValue
						value={formatMetricValue(
							userStats.summary.totalContributions,
							'integer',
						)}
						size={58}
						style={{letterSpacing: '-0.065em', lineHeight: 1.05}}
					/>
					<p
						style={{
							margin: '10px 0 0',
							fontSize: 14,
							color: theme.colors.muted,
						}}
					>
						contributions across GitHub
					</p>
				</div>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						columnGap: 38,
						gridAutoRows: '36px',
						marginTop: 38,
					}}
				>
					{metrics.map((metric) => (
						<MetricRow
							key={metric.id}
							icon={<metric.icon size={16} strokeWidth={1.5} />}
							label={metric.label}
							value={formatMetricValue(metric.value)}
							accent={theme.colors.muted}
							labelStyle={{fontSize: 13}}
						/>
					))}
				</div>
				<div style={{marginTop: 'auto', paddingTop: 20}}>
					<LanguageSignature userStats={userStats} />
					<div style={{marginTop: 12}}>
						<CollectionNote userStats={userStats} />
					</div>
				</div>
			</div>
		</Panel>
	);
}

function ProfileIdentity({
	userStats,
	classic = false,
}: ReadmeVariantProps & {classic?: boolean}) {
	const theme = useTheme();
	const name = userStats.name || userStats.username;

	return (
		<header
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: classic ? 16 : 13,
				minWidth: 0,
				flexShrink: 0,
			}}
		>
			<ProfileImage userStats={userStats} size={classic ? 40 : 44} />
			<div style={{minWidth: 0}}>
				<h1
					title={`Hi, I'm ${name}`}
					style={{
						margin: 0,
						fontSize: classic ? 16 : 18,
						fontWeight: classic ? 400 : 500,
						letterSpacing: classic ? 0 : '-0.025em',
						lineHeight: 1.4,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
					}}
				>
					Hi, I&apos;m {name}
				</h1>
				{!classic && (
					<p
						title={`@${userStats.username}`}
						style={{
							margin: '3px 0 0',
							fontSize: 12,
							lineHeight: 1.4,
							color: theme.colors.muted,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						@{userStats.username}
					</p>
				)}
			</div>
		</header>
	);
}

function ProfileImage({userStats, size}: ReadmeVariantProps & {size: number}) {
	const theme = useTheme();
	const name = userStats.name || userStats.username;
	const style: CSSProperties = {
		width: size,
		height: size,
		flexShrink: 0,
		borderRadius: '50%',
		objectFit: 'cover',
	};

	return userStats.avatarUrl ? (
		<Img src={userStats.avatarUrl} alt={`${name}'s avatar`} style={style} />
	) : (
		<div
			aria-label={`${name}'s initials`}
			style={{
				...style,
				display: 'grid',
				placeItems: 'center',
				background: theme.colors.panelLight,
				color: theme.colors.text,
				fontSize: size / 3,
			}}
		>
			{name
				.trim()
				.split(/\s+/)
				.slice(0, 2)
				.map((part) => part.charAt(0))
				.join('')}
		</div>
	);
}

function LanguageSignature({userStats}: ReadmeVariantProps) {
	const theme = useTheme();
	const languages = userStats.topLanguages.slice(0, 3);

	if (languages.length === 0) return null;

	return (
		<div>
			<div
				aria-hidden="true"
				style={{
					display: 'flex',
					height: 2,
					gap: 3,
					background: theme.colors.panelLight,
					borderRadius: 2,
					overflow: 'hidden',
				}}
			>
				{languages.map((language) => (
					<span
						key={language.languageName}
						style={{
							width: `${getLanguageShare(language, userStats.code.codeByteTotal)}%`,
							background: language.color || theme.colors.purple,
							flexShrink: 0,
						}}
					/>
				))}
			</div>
			<div style={{display: 'flex', gap: 18, marginTop: 9, minWidth: 0}}>
				{languages.map((language) => (
					<span
						key={language.languageName}
						title={language.languageName}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 6,
							fontSize: 11,
							lineHeight: 1.4,
							minWidth: 0,
							color: theme.colors.muted,
						}}
					>
						<span
							aria-hidden="true"
							style={{
								height: 4,
								width: 4,
								borderRadius: '50%',
								flexShrink: 0,
								background: language.color || theme.colors.purple,
							}}
						/>
						<span
							style={{
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							}}
						>
							{language.languageName}
						</span>
					</span>
				))}
			</div>
		</div>
	);
}

function profileMetrics(userStats: UserStats): ProfileMetric[] {
	const traffic = getOptionalMetricCoverage(userStats, 'traffic');
	const lines = getOptionalMetricCoverage(userStats, 'lines');

	return [
		{
			id: 'stars',
			icon: Sparkles,
			label: 'Stars',
			value: userStats.summary.starsReceived,
		},
		{
			id: 'forks',
			icon: GitFork,
			label: 'Forks',
			value: userStats.summary.forksReceived,
		},
		{
			id: 'commits',
			icon: GitCommitHorizontal,
			label: 'Commits',
			value: userStats.contributions.totalCommits,
		},
		{
			id: 'pull-requests',
			icon: GitPullRequest,
			label: 'Pull requests',
			value: userStats.community.totalPullRequests,
		},
		{
			id: 'open-issues',
			icon: ArrowUpFromLine,
			label: 'Open issues',
			value: userStats.community.openIssues,
		},
		{
			id: 'closed-issues',
			icon: ArrowDownFromLine,
			label: 'Closed issues',
			value: userStats.community.closedIssues,
		},
		{
			id: 'views',
			icon: Telescope,
			label: 'Repo views (2 wks)',
			value: optionalValue(userStats.repositories.repoViews, traffic),
		},
		{
			id: 'lines',
			icon: Diff,
			label: 'Lines of code changed',
			value: optionalValue(userStats.code.linesOfCodeChanged, lines),
		},
		{
			id: 'contributions',
			icon: HandHeart,
			label: 'Total contributions',
			value: userStats.summary.totalContributions,
		},
	];
}

function optionalValue(
	value: number,
	coverage: ReturnType<typeof getOptionalMetricCoverage>,
): number | string {
	if (!coverage.available) return coverage.label;
	if (coverage.state === 'complete') return value;
	return `${formatInteger(value)} (${coverage.state === 'unknown' ? 'unverified' : 'partial'})`;
}
