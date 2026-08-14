#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {renderCards} from './api';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const equalsIndex = arg.indexOf('=');
    if (equalsIndex > -1) {
      const key = arg.slice(2, equalsIndex);
      const value = arg.slice(equalsIndex + 1);
      args.set(key, value);
    } else {
      const key = arg.slice(2);
      const next = process.argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.set(key, next);
        i++;
      } else {
        args.set(key, 'true');
      }
    }
  }
}

const rawFormats = (args.get('formats') || 'webp')
  .split(',')
  .map((f) => f.trim())
  .filter(Boolean);

const formats: Array<'gif' | 'webp'> = [];
for (const format of rawFormats) {
  if (format !== 'gif' && format !== 'webp') {
    throw new Error(`Invalid format: ${format}. Must be 'gif' or 'webp'.`);
  }
  formats.push(format);
}

const compositionIds = (args.get('cards') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (compositionIds.length === 0) {
  console.error('Error: --cards is required');
  process.exit(1);
}

const entryPoint = args.get('entry-point');
if (!entryPoint) {
  console.error('Error: --entry-point is required');
  process.exit(1);
}

const propsPath = args.get('props');
const props = propsPath ? JSON.parse(readFileSync(propsPath, 'utf8')) : {};

renderCards({
  compositionIds,
  entryPoint,
  formats,
  outputDir: args.get('out-dir') || 'pages',
  props,
  concurrency: parsePositiveInt(args.get('concurrency'), 1),
  remotionConcurrency: args.get('remotion-concurrency')
    ? parsePositiveInt(args.get('remotion-concurrency'), 1)
    : undefined,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}
