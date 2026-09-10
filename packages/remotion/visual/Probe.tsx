import {useEffect, useLayoutEffect, useState, type RefObject} from 'react';
import {Artifact, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import type {z} from 'zod';
import {probeReportSchema} from './contracts.mjs';
import {measureForeground} from './measure';

type Report = z.infer<typeof probeReportSchema>;
export type ProbeOptions = {scenarioId: string; targetFrame: number; report: boolean};

export async function loadLocalFonts(): Promise<string[]> {
  const fonts = await Promise.all([400, 500, 600, 700].map(async (weight) => {
    const faces = await document.fonts.load(`${weight} 16px "Fira Code"`);
    if (faces.length === 0 || faces.some((face) => face.status !== 'loaded')) {
      throw new Error(`Local Fira Code ${weight} did not load; build/import @lukasparke/diffler-remotion/styles.css first.`);
    }
    return `${weight}: ${faces[0].family}`;
  }));
  await document.fonts.ready;
  return fonts;
}

/** Test-only. Emits a public Remotion Artifact so a failed check still has a PNG
 * to review. The Node harness treats every reported issue as a failing check. */
export function Probe({root, options}: {root: RefObject<HTMLDivElement>; options: ProbeOptions}) {
  const frame = useCurrentFrame();
  const {id: cardId, width, height} = useVideoConfig();
  const {scenarioId, targetFrame, report} = options;
  const [result, setResult] = useState<{handle: number; report: Report | null} | null>(null);

  useLayoutEffect(() => {
    const handle = delayRender(`Visual probe ${scenarioId}/${cardId} f${frame}`);
    let active = true;
    void loadLocalFonts().then((fontsLoaded) => {
      if (!active) return;
      if (!root.current) throw new Error('Visual probe root did not mount');
      const measured = report && frame === targetFrame ? {
        cardId, scenarioId, frame, width, height, fontsLoaded,
        ...measureForeground(root.current, width, height),
      } : null;
      setResult({handle, report: measured});
    }).catch((error: unknown) => {
      if (active) cancelRender(error instanceof Error ? error : new Error(String(error)));
      continueRender(handle);
    });
    return () => {
      active = false;
      continueRender(handle);
    };
  }, [cardId, frame, height, report, root, scenarioId, targetFrame, width]);

  // Child Artifact effects register before this parent effect releases the render.
  useEffect(() => {
    if (result) continueRender(result.handle);
  }, [result]);

  return result?.report?.frame === frame
    ? <Artifact filename="visual-layout.json" content={JSON.stringify(result.report)} />
    : null;
}
