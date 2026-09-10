import {Composition} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import {
  DurationInFrames,
  FPS,
  defaultStats,
  fetchUserStats,
  sourcePropsSchema,
} from '@lukasparke/diffler-remotion';
import type {SourceProps} from '@lukasparke/diffler-remotion';
import {cards} from '@lukasparke/diffler-remotion/cards';
import {defaultTheme, ThemeProvider} from '@lukasparke/diffler-remotion/themes';
import '@lukasparke/diffler-remotion/styles.css';

// Metadata receives the render's input props, not a second global data source.
type InputProps = SourceProps & Record<string, unknown>;
export const calculateMetadata: CalculateMetadataFunction<InputProps> = async ({props}) => {
  return {
    props: {
      userStats: await fetchUserStats(props),
      allowPrivateRepositoryDetails: props.allowPrivateRepositoryDetails,
    },
  };
};

export const RemotionRoot = () => (
  <>
    {cards.map(({
      id,
      component: Component,
      height,
      width = 500,
      durationInFrames = DurationInFrames,
    }) => (
      <Composition
        key={id}
        id={id}
        component={(props: InputProps) => {
          if (!props.userStats) throw new Error('Metadata must resolve a stats source before rendering');
          return (
            <ThemeProvider theme={defaultTheme}>
              <div style={{height: '100%', width: '100%', padding: 4}}>
                <Component userStats={props.userStats} />
              </div>
            </ThemeProvider>
          );
        }}
        durationInFrames={durationInFrames}
        fps={FPS}
        width={width}
        height={height}
        schema={sourcePropsSchema.passthrough()}
        calculateMetadata={calculateMetadata}
        defaultProps={{userStats: defaultStats}}
      />
    ))}
  </>
);
