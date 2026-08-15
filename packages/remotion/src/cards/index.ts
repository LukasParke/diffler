import {ComponentType} from 'react';
import {MainProps} from '../data';
import {ActivityOverviewCard} from './ActivityOverviewCard';
import {CodeMetricsCard} from './CodeMetricsCard';
import {CommitStreakCard} from './CommitStreakCard';
import {IssueTrackingCard} from './IssueTrackingCard';
import {LanguagesCard} from './LanguagesCard';
import {MainStatsCard} from './MainStatsCard';
import {PackageImpactCard} from './PackageImpactCard';
import {ReadmeClassicCard, ReadmeSpotlightCard} from './ReadmeCard';
import {RepositoryImpactCard} from './RepositoryImpactCard';
import {StatsCard} from './StatsCard';
import {TopLanguagesCard} from './TopLanguagesCard';

export type CardConfig = {
	id: string;
	component: ComponentType<{userStats: MainProps['userStats']}>;
	height: number;
	durationInFrames?: number;
	width?: number;
};

export const cards: CardConfig[] = [
	{
		id: 'readme',
		component: ReadmeSpotlightCard,
		width: 900,
		height: 460,
	},
	{
		id: 'readme-classic',
		component: ReadmeClassicCard,
		height: 520,
	},
	{
		id: 'readme-spotlight',
		component: ReadmeSpotlightCard,
		width: 900,
		height: 460,
	},
	{
		id: 'stats',
		component: StatsCard,
		height: 360,
	},
	{
		id: 'languages',
		component: LanguagesCard,
		height: 270,
	},
	{
		id: 'main-stats',
		component: MainStatsCard,
		height: 300,
	},
	{
		id: 'repo-impact',
		component: RepositoryImpactCard,
		height: 280,
	},
	{
		id: 'package-impact',
		component: PackageImpactCard,
		height: 300,
	},
	{
		id: 'issue-tracking',
		component: IssueTrackingCard,
		height: 280,
	},
	{
		id: 'code-metrics',
		component: CodeMetricsCard,
		height: 280,
	},
	{
		id: 'activity-overview',
		component: ActivityOverviewCard,
		height: 360,
	},
	{
		id: 'commit-streak',
		component: CommitStreakCard,
		height: 230,
	},
	{
		id: 'top-languages',
		component: TopLanguagesCard,
		height: 260,
	},
];

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
