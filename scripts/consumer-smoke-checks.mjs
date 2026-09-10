// Copied into an isolated tarball consumer by consumer-smoke.mjs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require = createRequire(import.meta.url);
const esm = await import('@lukasparke/diffler-remotion');
const cjs = require('@lukasparke/diffler-remotion');
const registries = [];
for (const [format, core, load] of [
  ['ESM', esm, (name) => import(name)],
  ['CJS', cjs, (name) => require(name)],
]) {
  const themes = await load('@lukasparke/diffler-remotion/themes');
  const {cards} = await load('@lukasparke/diffler-remotion/cards');
  const renderer = await load('@lukasparke/diffler-remotion/render');
  const schemas = await load('@lukasparke/diffler-schemas');
  await load('@lukasparke/diffler-schemas/v2');
  await load('@lukasparke/diffler-schemas/zod');
  assert.equal(typeof renderer.renderCards, 'function', `${format} render API`);
  assert.ok(schemas.userStatsSchema.safeParse(core.defaultStats).success, `${format} public fixture/schema`);
  assert.ok(cards.length > 0, `${format} card registry`);
  registries.push(cards);

  const theme = {...themes.defaultTheme, colors: {...themes.defaultTheme.colors, text: '#123456'}};
  const markup = renderToStaticMarkup(React.createElement(themes.ThemeProvider, {theme},
    React.createElement(core.Panel, {title: 'Consumer theme'}, 'content')));
  assert.match(markup, /color:#123456/, `${format}: /themes provider reaches root primitives`);
  function Probe() {
    return React.createElement('span', null, themes.useTheme().colors.text);
  }
  assert.match(renderToStaticMarkup(React.createElement(core.ThemeProvider, {theme}, React.createElement(Probe))),
    /#123456/, `${format}: root provider reaches /themes hook`);
}
assert.deepEqual(registries[0].map(({id}) => id), registries[1].map(({id}) => id));

const cssPath = require.resolve('@lukasparke/diffler-remotion/styles.css');
const css = await readFile(cssPath, 'utf8');
assert.doesNotMatch(css, /@tailwind\b|@import\b/, 'No unbuilt CSS directives or remote font imports');
assert.match(css, /box-sizing:\s*border-box/, 'Library base styles are emitted');
assert.match(css, /\.grid\s*\{\s*display:\s*grid/, 'Library Tailwind utilities are emitted');
assert.match(css, /font-family:\s*['"]?Fira Code/);
const fontUrls = [...css.matchAll(/url\(['"]?(\.\/fonts\/[^)'"\s]+\.woff2)['"]?\)/g)];
assert.ok(fontUrls.length >= 4, 'Font URLs included in published stylesheet');
for (const [, font] of fontUrls) {
  const file = await readFile(resolve(dirname(cssPath), font));
  assert.equal(file.toString('ascii', 0, 4), 'wOF2', `Valid local font: ${font}`);
}
assert.match(await readFile(join(dirname(cssPath), 'fonts/LICENSE.txt'), 'utf8'), /SIL OPEN FONT LICENSE/);

const packageDir = resolve(dirname(cssPath), '..');
const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
assert.equal(manifest.dependencies['@remotion/bundler'], '4.0.509');
assert.equal(manifest.dependencies['@remotion/renderer'], '4.0.509');
assert.equal(manifest.dependencies['@remotion/cli'], undefined, 'No runtime CLI dependency');
assert.ok((await realpath(packageDir)).startsWith(process.cwd()), 'Test the installed tarball, not a workspace link');
// Resolve the programmatic tools declared by the published render API, not root dev dependencies.
const rendererRequire = createRequire(require.resolve('@lukasparke/diffler-remotion/render'));
const {bundle} = rendererRequire('@remotion/bundler');
const {getCompositions, openBrowser, renderStill} = rendererRequire('@remotion/renderer');

const serveUrl = await bundle({
  entryPoint: resolve('src/index.tsx'),
  rootDir: process.cwd(),
  outDir: resolve('bundle'),
  // Deliberately no Tailwind override or scan of installed library code.
  enableCaching: false,
});
console.log('Published example bundles without consumer Tailwind configuration.');

if (process.argv.includes('--render')) {
  const output = process.argv[process.argv.indexOf('--render') + 1];
  await mkdir(output, {recursive: true});
  const puppeteerInstance = await openBrowser('chrome', {
    browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || undefined,
    chromiumOptions: {gl: 'swiftshader'},
    logLevel: 'error',
  });
  try {
    const inputProps = {userStats: {
      ...esm.defaultStats,
      name: 'Diffler Demo', username: 'diffler-demo',
      avatarUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="24" fill="#58a6ff"/><path d="M24 24h24a24 24 0 0 1 0 48H24z" fill="#0d1117"/></svg>'),
    }};
    const compositions = await getCompositions(serveUrl, {inputProps, puppeteerInstance, logLevel: 'error'});
    const dimensions = (composition) => [composition.id, composition.width, composition.height, composition.durationInFrames, composition.fps];
    assert.deepEqual(compositions.map(dimensions), registries[0].map((card) => [
      card.id, card.width ?? 500, card.height, card.durationInFrames ?? esm.DurationInFrames, esm.FPS,
    ]), 'Example compositions use the published registry');
    const composition = compositions.find(({id}) => id === 'readme');
    assert.ok(composition, 'Public readme composition exists');
    const frame = Math.min(60, composition.durationInFrames - 1);
    for (const name of ['readme', 'readme-repeat']) {
      await renderStill({serveUrl, composition, inputProps, frame, puppeteerInstance,
        output: join(output, `${name}.png`), imageFormat: 'png', logLevel: 'error'});
    }
    const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
    assert.equal(await digest(join(output, 'readme.png')), await digest(join(output, 'readme-repeat.png')),
      'The same fixture and frame render identically twice');

    const themeBundle = await bundle({entryPoint: resolve('consumer-smoke-entry.tsx'), rootDir: process.cwd(),
      outDir: resolve('theme-bundle'), enableCaching: false});
    const themes = await getCompositions(themeBundle, {puppeteerInstance, logLevel: 'error'});
    for (const themedComposition of themes) {
      await renderStill({serveUrl: themeBundle, composition: themedComposition, frame: 60, puppeteerInstance,
        output: join(output, `${themedComposition.id}.png`), imageFormat: 'png', logLevel: 'error'});
    }
    // Exercise the published product API too, not only Remotion's underlying APIs.
    const {renderCards} = await import('@lukasparke/diffler-remotion/render');
    await renderCards({
      entryPoint: resolve('src/index.tsx'), compositionIds: ['stats'], formats: ['png'],
      outputDir: resolve('render-api-output'), props: inputProps, stillFrame: 60,
      concurrency: 1, remotionConcurrency: 1,
      browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || undefined,
    });
    const rendered = await readFile(resolve('render-api-output/stats.png'));
    assert.equal(rendered.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Public render API writes PNG');
    const statsComposition = compositions.find(({id}) => id === 'stats');
    assert.deepEqual([rendered.readUInt32BE(16), rendered.readUInt32BE(20)],
      [statsComposition.width * 2, statsComposition.height * 2], 'Public API uses the default 2× composition dimensions');
    await copyFile(resolve('render-api-output/stats.png'), join(output, 'stats-api.png'));
    console.log(`Deterministic render, public render API, cross-entry ESM/CJS themes, CSS and fonts passed. Artifacts: ${output}`);
  } finally {
    await puppeteerInstance.close({silent: true});
  }
}
