// @ts-check
import {z} from 'zod';

export const themeNameSchema = z.enum(['default', 'dracula', 'github']);
export const probeControlFailures = Object.freeze([false, true, true, true, false, true]);

export const probeReportSchema = z.object({
  cardId: z.string(),
  scenarioId: z.string(),
  frame: z.number().int().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  textNodesChecked: z.number().int().positive(),
  graphicsChecked: z.number().int().nonnegative(),
  fontsLoaded: z.array(z.string()).min(4),
  issues: z.array(z.string()),
  intentionalTruncations: z.array(z.string()),
}).strict();

export const sheetPropsSchema = z.object({
  title: z.string(),
  matte: z.enum(['dark', 'light']),
  tiles: z.array(z.object({
    label: z.string(),
    src: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
    failed: z.boolean(),
  })),
});

/** @param {string} selection @param {number} durationInFrames @param {number} fps */
export function sampleFrames(selection, durationInFrames, fps) {
  const frames = selection.split(',').map((token) => {
    const value = token.trim();
    const frame = value === 'first' ? 0 : value === 'key' ? Math.round(2.6 * fps)
      : value === 'settled' ? durationInFrames - 1 : /^\d+$/.test(value) ? Number(value) : NaN;
    if (!Number.isSafeInteger(frame) || frame < 0 || frame >= durationInFrames) {
      throw new Error(`Invalid frame "${value}" for a ${durationInFrames}-frame composition`);
    }
    return frame;
  });
  return [...new Set(frames)].sort((a, b) => a - b);
}
