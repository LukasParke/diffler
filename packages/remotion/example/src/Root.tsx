import {CalculateMetadataFunction, Composition, getInputProps} from 'remotion';
import './style.css';

import {
  FPS,
  DurationInFrames,
  fetchUserStats,
  SourceProps,
  MainProps,
  mainSchema,
  defaultStats,
} from 'github-readme-cards';
import {
  ReadmeCard,
  ReadmeClassicCard,
  ReadmeSpotlightCard,
  StatsCard,
  LanguagesCard,
  MainStatsCard,
  RepositoryImpactCard,
  IssueTrackingCard,
  CodeMetricsCard,
  ActivityOverviewCard,
  CommitStreakCard,
  TopLanguagesCard,
} from 'github-readme-cards/cards';

export const RemotionRoot = () => {
  const calculateMetadata: CalculateMetadataFunction<MainProps> = async (
    props
  ) => {
    const inputProps = getInputProps() as SourceProps;
    const userStats = await fetchUserStats(inputProps);

    return {
      props: {
        ...props,
        userStats,
      },
    };
  };

  const cards = [
    {id: 'readme', component: ReadmeCard, width: 900, height: 460},
    {id: 'readme-classic', component: ReadmeClassicCard, width: 500, height: 520},
    {
      id: 'readme-spotlight',
      component: ReadmeSpotlightCard,
      width: 900,
      height: 460,
      durationInFrames: FPS * 12,
    },
    {id: 'stats', component: StatsCard, width: 500, height: 360},
    {id: 'languages', component: LanguagesCard, width: 500, height: 270},
    {id: 'main-stats', component: MainStatsCard, width: 500, height: 300},
    {id: 'repo-impact', component: RepositoryImpactCard, width: 500, height: 280},
    {id: 'issue-tracking', component: IssueTrackingCard, width: 500, height: 280},
    {id: 'code-metrics', component: CodeMetricsCard, width: 500, height: 280},
    {id: 'activity-overview', component: ActivityOverviewCard, width: 500, height: 360},
    {id: 'commit-streak', component: CommitStreakCard, width: 500, height: 230},
    {id: 'top-languages', component: TopLanguagesCard, width: 500, height: 260},
  ];

  return (
    <>
      {cards.map(
        ({
          id,
          component: Component,
          height,
          width = 500,
          durationInFrames = DurationInFrames,
        }) => (
          <Composition
            key={id}
            id={id}
            component={(props: MainProps) => (
              <div className="h-full w-full p-1">
                <Component userStats={props.userStats} />
              </div>
            )}
            durationInFrames={durationInFrames}
            fps={FPS}
            width={width}
            height={height}
            schema={mainSchema}
            calculateMetadata={calculateMetadata}
            defaultProps={{
              userStats: defaultStats,
            }}
          />
        )
      )}
    </>
  );
};
