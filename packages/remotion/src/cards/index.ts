import {
	cardDefinitions,
	type CardId,
	type CardPlayback,
} from '@lukasparke/diffler-schemas';
import {ComponentType} from 'react';
import {FPS} from '../config';
import {MainProps} from '../data';
import {ActivityOverviewCard} from './ActivityOverviewCard';
import {CodeMetricsCard} from './CodeMetricsCard';
import {CommitStreakCard} from './CommitStreakCard';
import {IssueTrackingCard} from './IssueTrackingCard';
import {LanguagesCard} from './LanguagesCard';
import {MainStatsCard} from './MainStatsCard';
import {PackageImpactCard} from './PackageImpactCard';
import {ReadmeCard, ReadmeClassicCard, ReadmeSpotlightCard} from './ReadmeCard';
import {RepositoryImpactCard} from './RepositoryImpactCard';
import {StatsCard} from './StatsCard';
import {TopLanguagesCard} from './TopLanguagesCard';

export type CardConfig = {
	id: string;
	component: ComponentType<{userStats: MainProps['userStats']}>;
	height: number;
	durationInFrames?: number;
	width?: number;
	title?: string;
	playback?: CardPlayback;
};

const components: Record<CardId, CardConfig['component']> = {
	readme: ReadmeCard,
	'readme-classic': ReadmeClassicCard,
	'readme-spotlight': ReadmeSpotlightCard,
	stats: StatsCard,
	languages: LanguagesCard,
	'main-stats': MainStatsCard,
	'repo-impact': RepositoryImpactCard,
	'issue-tracking': IssueTrackingCard,
	'code-metrics': CodeMetricsCard,
	'activity-overview': ActivityOverviewCard,
	'commit-streak': CommitStreakCard,
	'top-languages': TopLanguagesCard,
	'package-impact': PackageImpactCard,
};

export const cards: CardConfig[] = cardDefinitions.map((definition) => ({
	id: definition.id,
	title: definition.title,
	component: components[definition.id],
	width: definition.width,
	height: definition.height,
	durationInFrames: definition.durationInSeconds * FPS,
	playback: definition.playback,
}));

export {ActivityOverviewCard} from './ActivityOverviewCard';
export {CodeMetricsCard} from './CodeMetricsCard';
export {CommitStreakCard} from './CommitStreakCard';
export {IssueTrackingCard} from './IssueTrackingCard';
export {LanguagesCard} from './LanguagesCard';
export {MainStatsCard} from './MainStatsCard';
export {PackageImpactCard} from './PackageImpactCard';
export {ReadmeCard, ReadmeClassicCard, ReadmeSpotlightCard} from './ReadmeCard';
export {RepositoryImpactCard} from './RepositoryImpactCard';
export {StatsCard} from './StatsCard';
export {TopLanguagesCard} from './TopLanguagesCard';
