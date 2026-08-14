import {existsSync} from 'node:fs';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {RenderConfig} from './config';

export async function renderCards(config: RenderConfig): Promise<void> {
  const {
    compositionIds,
    entryPoint,
    formats,
    outputDir,
    props,
    concurrency = 1,
    remotionConcurrency,
  } = config;

  const needsAnimation = formats.includes('gif') || formats.includes('webp');
  const tempDir = join(outputDir, '.tmp');

  const propsFile = join(
    tmpdir(),
    `remotion-props-${randomBytes(8).toString('hex')}.json`,
  );
  await writeFile(propsFile, JSON.stringify(props), 'utf8');

  try {
  await rm(outputDir, {recursive: true, force: true});
  await mkdir(outputDir, {recursive: true});
  if (needsAnimation) {
    await mkdir(tempDir, {recursive: true});
  }

  console.log(
      `Rendering ${compositionIds.length} cards to ${outputDir} with concurrency ${concurrency}`,
  );

  await runPool(
    compositionIds,
    Math.min(concurrency, compositionIds.length),
    async (id) => {
      const masterPath = join(tempDir, `${id}.webm`);

      if (needsAnimation) {
        const remotionArgs = [
          'remotion',
          'render',
          entryPoint,
          id,
          masterPath,
          '--props',
          propsFile,
          '--codec',
          'vp9',
          '--crf',
            '10',
          '--pixel-format',
          'yuv444p',
        ];
        if (remotionConcurrency) {
          remotionArgs.push('--concurrency', String(remotionConcurrency));
        }
          await run('npx', ['--no-install', ...remotionArgs]);
      }

      if (formats.includes('webp')) {
          await run('ffmpeg', [
          '-y',
          '-i',
          masterPath,
          '-vf',
            'fps=12',
          '-loop',
          '0',
          '-c:v',
          'libwebp',
          '-quality',
          '84',
          '-compression_level',
          '6',
          '-preset',
          'picture',
          '-an',
          join(outputDir, `${id}.webp`),
        ]);
      }

      if (formats.includes('gif')) {
          await run('ffmpeg', [
          '-y',
          '-i',
          masterPath,
          '-filter_complex',
            '[0:v]fps=8,split[frames][palette_source];[palette_source]palettegen=max_colors=256:stats_mode=diff[palette];[frames][palette]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
          '-loop',
          '0',
          join(outputDir, `${id}.gif`),
        ]);
      }

      await rm(masterPath, {force: true});
      },
  );

    await writeFile(
      join(outputDir, 'index.html'),
      buildIndexHtml(compositionIds, formats),
      'utf8',
    );
  } finally {
  if (existsSync(tempDir)) {
    await rm(tempDir, {recursive: true, force: true});
  }
  await rm(propsFile, {force: true}).catch(() => {});
  }
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({length: concurrency}, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex]);
    }
  });
  await Promise.all(workers);
}

function run(command: string, commandArgs: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {stdio: 'inherit'});
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(' ')} failed`));
    });
  });
}

function buildIndexHtml(compositionIds: string[], formats: string[]): string {
  const images = compositionIds
    .map((id) => {
      const webp = formats.includes('webp')
        ? `<img src="./${id}.webp" alt="${id}" />`
        : '';
      const gif = formats.includes('gif')
        ? `<img src="./${id}.gif" alt="${id} gif fallback" />`
        : '';
      return `<section><h2>${id}</h2>${webp}${gif}</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GitHub Stats Remotion Assets</title>
  <style>
    body { margin: 0; padding: 24px; background: #0d1117; color: #f0f3f6; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    main { display: grid; gap: 24px; max-width: 900px; margin: 0 auto; }
    section { display: grid; gap: 8px; }
    h1, h2 { margin: 0; }
    h2 { color: #8b949e; font-size: 14px; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <main>
    <h1>GitHub Stats Remotion Assets</h1>
    ${images}
  </main>
</body>
</html>
`;
}
