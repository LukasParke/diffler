import {useRef, type ComponentType, type CSSProperties} from 'react';
import {Composition, Img, cancelRender, registerRoot, useCurrentFrame} from 'remotion';
import {Config, ThemeProvider, defaultTheme, draculaTheme, githubTheme, themeToCssVariables, type UserStats} from '@lukasparke/diffler-remotion';
import {cards} from '@lukasparke/diffler-remotion/cards';
import '@lukasparke/diffler-remotion/styles.css';
import type {z} from 'zod';
import {probeControlFailures, sheetPropsSchema, themeNameSchema} from './contracts.mjs';
import {visualScenarios} from './fixtures.mjs';
import {Probe, type ProbeOptions} from './Probe';

const themes = {default: defaultTheme, dracula: draculaTheme, github: githubTheme};
// Attach measurement refs to actual DOM elements. Remotion 4.0.509's
// AbsoluteFill inner component receives refs as props, which React 18 strips.
const fillStyle: CSSProperties = {position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column'};
type VisualProps = {userStats: UserStats; visual: ProbeOptions; theme: z.infer<typeof themeNameSchema>};
type SheetProps = z.infer<typeof sheetPropsSchema>;
const defaults: VisualProps = {
  userStats: visualScenarios[0].userStats,
  visual: {scenarioId: 'normal', targetFrame: 0, report: true},
  theme: 'default',
};

// Only the local bundle, local fonts and embedded images are allowed. A blocked
// request fails the render rather than quietly leaving a missing asset behind.
const policy = document.createElement('meta');
policy.httpEquiv = 'Content-Security-Policy';
policy.content = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'none'; object-src 'none'; frame-src 'none'";
document.head.appendChild(policy);
document.addEventListener('securitypolicyviolation', (event) => {
  cancelRender(new Error(`Visual fixture attempted a forbidden resource: ${event.blockedURI} (${event.violatedDirective})`));
});

function VisualCard({Component, userStats, visual, theme}: VisualProps & {Component: ComponentType<{userStats: UserStats}>}) {
  const root = useRef<HTMLDivElement>(null);
  const resolvedTheme = themes[theme];
  return (
    <ThemeProvider theme={resolvedTheme}>
      {/* Match the public compositions' four-pixel transparent outer gutter. */}
      <div ref={root} data-diffler="card" style={{...fillStyle, ...themeToCssVariables(resolvedTheme), boxSizing: 'border-box', padding: 4, backgroundColor: 'transparent', color: resolvedTheme.colors.text, fontFamily: resolvedTheme.typography.fontFamily}}>
        <Component userStats={userStats} />
        <Probe root={root} options={visual} />
      </div>
    </ThemeProvider>
  );
}

function ProbeControl({visual}: {visual: ProbeOptions}) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useCurrentFrame();
  const text = frame === 4 ? 'Visible text' : 'Deliberately long foreground value';
  return (
    <div ref={root} data-diffler="probe-control" style={{...fillStyle, background: '#282a36', color: '#f8f8f2'}}>
      <div aria-hidden="true" style={{position: 'absolute', left: -500, top: -500, width: 1000, height: 1000}}>Decorative overflow must be ignored</div>
      <div title={frame === 1 ? undefined : text} style={{position: 'absolute', left: frame === 3 ? 220 : 12, top: 12, width: frame === 4 ? 200 : 100, height: 24, lineHeight: '24px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
        <span style={{display: 'inline-block', transform: frame === 2 ? 'translateY(20px)' : undefined}}>{text}</span>
      </div>
      {frame === 5 ? (
        <svg viewBox="0 0 240 100" role="img" aria-label="Foreground stroke overflow control" style={{position: 'absolute', inset: 0, width: 240, height: 100, overflow: 'visible'}}>
          <path d="M12 80H280" stroke="#f8f8f2" strokeWidth={4} />
        </svg>
      ) : null}
      <Probe root={root} options={visual} />
    </div>
  );
}

const tileWidth = 360;
function sheetSize({tiles}: SheetProps) {
  const imageHeight = Math.ceil(Math.max(120, ...tiles.map((tile) => tile.height * tileWidth / tile.width)));
  return {width: 3 * tileWidth + 64, height: 70 + Math.max(1, Math.ceil(tiles.length / 3)) * (imageHeight + 56), imageHeight};
}

function ContactSheet(props: SheetProps) {
  const root = useRef<HTMLDivElement>(null);
  const {imageHeight} = sheetSize(props);
  return (
    <div ref={root} data-diffler="review-sheet" style={{...fillStyle, padding: 16, background: props.matte === 'dark' ? '#0d1117' : '#ffffff', color: props.matte === 'dark' ? '#f0f3f6' : '#1f2328'}}>
      <h1 style={{fontSize: 15, fontWeight: 500, margin: '0 0 18px', height: 36}}>{props.title} · {props.matte} matte · 360px previews</h1>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 360px)', gap: 16}}>
        {props.tiles.map((tile) => (
          <div key={tile.label}>
            <div style={{height: imageHeight}}><Img src={tile.src} style={{width: tileWidth, height: tile.height * tileWidth / tile.width}} /></div>
            <p style={{fontSize: 10, margin: '8px 0 0', height: 32, color: tile.failed ? (props.matte === 'dark' ? '#ffb3b3' : '#9a1515') : 'inherit'}}>{tile.label}{tile.failed ? ' · FAIL' : ''}</p>
          </div>
        ))}
      </div>
      <Probe root={root} options={{scenarioId: 'contact-sheet', targetFrame: 0, report: false}} />
    </div>
  );
}

function VisualRoot() {
  return <>
    {cards.map(({id, component: Component, width = 500, height, durationInFrames = Config.DurationInFrames}) => (
      <Composition key={id} id={id} width={width} height={height} fps={Config.FPS} durationInFrames={durationInFrames} defaultProps={defaults} component={(props: VisualProps) => <VisualCard {...props} Component={Component} />} />
    ))}
    <Composition id="visual-probe-control" width={240} height={100} fps={Config.FPS} durationInFrames={probeControlFailures.length} component={ProbeControl} defaultProps={{visual: defaults.visual}} />
    <Composition id="visual-contact-sheet" fps={1} durationInFrames={1} schema={sheetPropsSchema} calculateMetadata={({props}) => sheetSize(props)} component={ContactSheet} defaultProps={{title: 'Visual review', matte: 'dark', tiles: []}} />
  </>;
}

registerRoot(VisualRoot);
