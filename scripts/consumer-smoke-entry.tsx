import React, {useEffect, useRef, useState} from 'react';
import {cancelRender, Composition, continueRender, delayRender, registerRoot} from 'remotion';
import * as core from '@lukasparke/diffler-remotion';
import * as themes from '@lukasparke/diffler-remotion/themes';
import {cards, StatsCard} from '@lukasparke/diffler-remotion/cards';
import '@lukasparke/diffler-remotion/styles.css';

// Webpack selects the actual require branches as well as the ESM branches above.
const cjsCore: typeof core = require('@lukasparke/diffler-remotion');
const cjsThemes: typeof themes = require('@lukasparke/diffler-remotion/themes');
const cjsCards: {StatsCard: typeof StatsCard} = require('@lukasparke/diffler-remotion/cards');
const config = cards.find(({id}) => id === 'stats')!;
const theme = {...themes.defaultTheme, colors: {...themes.defaultTheme.colors, text: '#123456'}};

function ThemeSmoke({format}: {format: 'esm' | 'cjs'}) {
  const Provider = format === 'esm' ? themes.ThemeProvider : cjsThemes.ThemeProvider;
  const Card = format === 'esm' ? StatsCard : cjsCards.StatsCard;
  const Panel = format === 'esm' ? core.Panel : cjsCore.Panel;
  const card = useRef<HTMLDivElement>(null);
  const utilities = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender('Published fonts, CSS, and cross-entry card theme'));

  useEffect(() => {
    const check = async () => {
      for (const weight of [400, 500, 600, 700]) {
        const loaded = await document.fonts.load(`${weight} 16px "Fira Code"`, 'Diffler 0123456789');
        if (loaded.length === 0 || loaded.some((font) => font.status !== 'loaded')) {
          throw new Error(`Published Fira Code ${weight} did not load`);
        }
      }
      const cardElement = card.current?.firstElementChild;
      const panel = utilities.current?.firstElementChild;
      if (!cardElement || !panel) throw new Error('Published card/panel did not mount');
      if (getComputedStyle(utilities.current!).display !== 'grid') {
        throw new Error('Published Tailwind utility is missing');
      }
      if (getComputedStyle(cardElement).color !== 'rgb(18, 52, 86)') {
        throw new Error(`${format}: /themes provider did not reach /cards`);
      }
      const style = getComputedStyle(panel);
      if (style.boxSizing !== 'border-box' || style.fontVariantNumeric !== 'tabular-nums') {
        throw new Error('Published base styles are missing');
      }
      if (!style.fontFamily.includes('Fira Code')) throw new Error('Published Fira Code is not applied');
      continueRender(handle);
    };
    check().catch(cancelRender);
  }, [format, handle]);

  return (
    <Provider theme={theme}>
      <div ref={card} style={{height: config.height}}>
        <Card userStats={core.defaultStats} />
      </div>
      <div ref={utilities} className="grid" style={{height: 64}}>
        <Panel><span>Font 0123456789</span></Panel>
      </div>
    </Provider>
  );
}

registerRoot(() => (
  <>
    {(['esm', 'cjs'] as const).map((format) => (
      <Composition key={format} id={`theme-${format}`} component={ThemeSmoke}
        width={config.width ?? 500} height={config.height + 64} fps={core.FPS}
        durationInFrames={core.DurationInFrames} defaultProps={{format}} />
    ))}
  </>
));
