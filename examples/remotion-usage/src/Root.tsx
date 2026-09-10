import {Composition} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import {
  DurationInFrames,
  FPS,
  defaultStats,
  fetchUserStats,
  mainSchema,
} from '@lukasparke/diffler-remotion';
import type {MainProps, SourceProps} from '@lukasparke/diffler-remotion';
import {cards} from '@lukasparke/diffler-remotion/cards';
import {defaultTheme, ThemeProvider} from '@lukasparke/diffler-remotion/themes';
import '@lukasparke/diffler-remotion/styles.css';

// Metadata receives the render's input props, not a second global data source.
const calculateMetadata: CalculateMetadataFunction<MainProps> = async ({props}) => {
  const source = props as MainProps & SourceProps;
  const hasSource = source.stats !== undefined || source.statsUrl ||
    source.username || source.usernames?.length;
  return {
    props: {
      userStats: hasSource ? await fetchUserStats(source) : props.userStats,
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
        component={(props: MainProps) => (
          <ThemeProvider theme={defaultTheme}>
            <div style={{height: '100%', width: '100%', padding: 4}}>
              <Component userStats={props.userStats} />
            </div>
          </ThemeProvider>
        )}
        durationInFrames={durationInFrames}
        fps={FPS}
        width={width}
        height={height}
        schema={mainSchema}
        calculateMetadata={calculateMetadata}
        defaultProps={{userStats: defaultStats}}
      />
    ))}
  </>
);
