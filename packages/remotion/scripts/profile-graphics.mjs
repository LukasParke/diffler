#!/usr/bin/env node
// @ts-check
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {caseFailed, galleryHtml} from '../visual/gallery.mjs';
import {probeControlFailures, probeReportSchema, sampleFrames, themeNameSchema} from '../visual/contracts.mjs';
import {serveBundle} from '../visual/serve.mjs';

/** @typedef {import('../visual/gallery.mjs').CaseResult} CaseResult */
/** @typedef {import('../visual/fixtures.mjs').VisualScenario} VisualScenario */

/** @template {{id: string}} T @param {string | undefined} selection @param {readonly T[]} available */
function select(selection, available) {
  const ids = selection === undefined || selection === 'all' ? available.map(({id}) => id) : selection.split(',').map((id) => id.trim());
  if (ids.length === 0) throw new Error('A visual run needs at least one card and scenario');
  if (new Set(ids).size !== ids.length) throw new Error('Selections must not contain duplicates');
  return ids.map((id) => {
    const value = available.find((item) => item.id === id);
    if (!value || !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(id)) throw new Error(`Unknown selection "${id}". Choose: ${available.map((item) => item.id).join(', ')}`);
    return value;
  });
}

/** @param {unknown} error */
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {Buffer} bytes */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function main() {
  const {values} = parseArgs({options: {
    cards: {type: 'string'}, scenarios: {type: 'string'}, frames: {type: 'string'},
    theme: {type: 'string'}, 'out-dir': {type: 'string'},
    'browser-executable': {type: 'string'}, help: {type: 'boolean'}, list: {type: 'boolean'},
  }});
  if (values.help) {
    console.log(`Usage: node packages/remotion/scripts/profile-graphics.mjs [options]
  --cards readme,readme-classic     Default: all public cards
  --scenarios normal,empty         Default: normal,empty,sparse,long,large,pending
  --frames first,key,settled       Default: 0, 2.6 seconds, final frame; integers also accepted
  --theme default|dracula|github   Default: default (one theme per run)
  --out-dir PATH                  Default: packages/remotion/visual/.artifacts/graphics
  --browser-executable PATH       Installed Chrome; or REMOTION_BROWSER_EXECUTABLE
  --list                          List the built registry and fixtures without rendering
Build @lukasparke/diffler-schemas and @lukasparke/diffler-remotion first. Nothing is installed/downloaded.
Each run creates a fresh review-* directory and leaves unrelated files untouched.
Exit 1 means a geometry, probe-control, render, or public-API parity check failed.`);
    return;
  }

  const [{bundle}, {openBrowser, renderStill, selectComposition}, {renderCards}, {cards}, {Config}, {visualScenarios, fixtureTime}] = await Promise.all([
    import('@remotion/bundler'), import('@remotion/renderer'), import('@lukasparke/diffler-remotion/render'),
    import('@lukasparke/diffler-remotion/cards'), import('@lukasparke/diffler-remotion'), import('../visual/fixtures.mjs'),
  ]);
  const selectedCards = select(values.cards, cards);
  const scenarios = select(values.scenarios, visualScenarios);
  const theme = themeNameSchema.parse(values.theme ?? 'default');
  const frames = values.frames ?? 'first,key,settled';
  for (const card of selectedCards) sampleFrames(frames, card.durationInFrames ?? Config.DurationInFrames, Config.FPS);
  if (values.list) {
    console.log(JSON.stringify({cards: selectedCards.map(({component, ...card}) => card), scenarios: scenarios.map(({id, description}) => ({id, description})), theme, frames}, null, 2));
    return;
  }
  const browserExecutable = values['browser-executable'] ?? process.env.REMOTION_BROWSER_EXECUTABLE ?? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find((path) => existsSync(path));
  if (!browserExecutable || !existsSync(browserExecutable)) {
    throw new Error('Supply --browser-executable (or REMOTION_BROWSER_EXECUTABLE) pointing to installed Chrome/Chromium. This harness never downloads a browser.');
  }

  const packageDir = fileURLToPath(new URL('../', import.meta.url));
  const entryPoint = join(packageDir, 'visual', 'entry.tsx');
  const outputRoot = resolve(values['out-dir'] ?? join(packageDir, 'visual', '.artifacts', 'graphics'));
  await mkdir(outputRoot, {recursive: true});
  const outputDir = await mkdtemp(join(outputRoot, `review-${theme}-`));
  const workDir = await mkdtemp(join(outputDir, '.work-'));
  console.log(`Visual review: ${outputDir}`);
  /** @type {Awaited<ReturnType<typeof openBrowser>> | undefined} */
  let browser;
  /** @type {Awaited<ReturnType<typeof serveBundle>> | undefined} */
  let bundleServer;
  try {
    const publicDir = join(workDir, 'public');
    await mkdir(publicDir);
    const bundleDirectory = await bundle({entryPoint, rootDir: packageDir, publicDir, outDir: join(workDir, 'bundle'), enableCaching: false});
    bundleServer = await serveBundle(bundleDirectory);
    browser = await openBrowser('chrome', {browserExecutable: resolve(browserExecutable), logLevel: 'error'});
    const shared = {serveUrl: bundleServer.url, puppeteerInstance: browser};

    /** @param {{id: string, width?: number, height: number}} card @param {VisualScenario} scenario @param {number} frame @param {string} image */
    async function renderCase(card, scenario, frame, image) {
      const started = performance.now();
      /** @type {CaseResult} */
      const result = {cardId: card.id, scenarioId: scenario.id, frame, width: card.width ?? 500, height: card.height, image: null, sha256: null, bytes: 0, elapsedMs: 0, report: null, error: null};
      try {
        const inputProps = {userStats: scenario.userStats, theme, visual: {scenarioId: scenario.id, targetFrame: frame, report: true}};
        const composition = await selectComposition({...shared, id: card.id, inputProps, logLevel: 'error'});
        let reportContent = '';
        await renderStill({...shared, composition, inputProps, frame, imageFormat: 'png', scale: 1, overwrite: false, output: join(outputDir, image), logLevel: 'error', onArtifact: (artifact) => {
          if (artifact.filename === 'visual-layout.json' && artifact.frame === frame) {
            reportContent = typeof artifact.content === 'string' ? artifact.content : new TextDecoder().decode(artifact.content);
          }
        }});
        const png = await readFile(join(outputDir, image));
        if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== result.width || png.readUInt32BE(20) !== result.height) {
          throw new Error(`Rendered PNG does not match ${result.width}×${result.height} registry dimensions`);
        }
        result.image = image;
        result.bytes = png.length;
        result.sha256 = sha256(png);
        if (!reportContent) throw new Error(`No DOM probe attestation for ${scenario.id}/${card.id} f${frame}; a PNG alone is not a passing check`);
        result.report = probeReportSchema.parse(JSON.parse(reportContent));
        if (result.report.cardId !== card.id || result.report.scenarioId !== scenario.id || result.report.frame !== frame || result.report.width !== result.width || result.report.height !== result.height) {
          throw new Error('DOM probe attestation does not match the requested card, scenario, frame or dimensions');
        }
      } catch (error) {
        result.error = message(error);
      }
      result.elapsedMs = Math.round(performance.now() - started);
      return result;
    }

    // Real browser controls prove that titles cannot hide vertical/outer clipping,
    // missing titles fail, and aria-hidden decoration is not counted as content.
    /** @type {CaseResult[]} */
    const controls = [];
    for (const [frame, expectedFailure] of probeControlFailures.entries()) {
      const control = await renderCase({id: 'visual-probe-control', width: 240, height: 100}, {id: 'probe-control', description: '', userStats: scenarios[0].userStats}, frame, `probe-control-${frame}.png`);
      controls.push(control);
      if (control.error || !control.report || (control.report.issues.length > 0) !== expectedFailure || (frame === 0 && control.report.intentionalTruncations.length === 0)) {
        await writeFile(join(outputDir, 'probe-controls.json'), JSON.stringify(controls, null, 2));
        throw new Error(`Probe control f${frame} failed its expected ${expectedFailure ? 'clipping detection' : 'clean layout'}: ${control.error ?? control.report?.issues.join('; ')}. See ${outputDir}/probe-controls.json`);
      }
    }

    /** @type {CaseResult[]} */
    const results = [];
    for (const scenario of scenarios) {
      console.log(`Rendering ${scenario.id} · ${selectedCards.length} cards · ${frames}`);
      for (const card of selectedCards) {
        for (const frame of sampleFrames(frames, card.durationInFrames ?? Config.DurationInFrames, Config.FPS)) {
          results.push(await renderCase(card, scenario, frame, `${scenario.id}--${card.id}--f${String(frame).padStart(3, '0')}.png`));
        }
      }
    }

    /** @type {string | null} */
    let apiError = null;
    const reference = results.filter((result) => result.scenarioId === scenarios[0].id && result.cardId === selectedCards[0].id && result.image).at(-1);
    try {
      if (!reference) throw new Error('No rendered reference PNG available for public renderCards parity');
      await renderCards({
        compositionIds: [reference.cardId], entryPoint, formats: ['png'], outputDir: join(outputDir, 'api-smoke'),
        props: {userStats: scenarios[0].userStats, theme, visual: {scenarioId: scenarios[0].id, targetFrame: reference.frame, report: false}},
        concurrency: 1, remotionConcurrency: 1, scale: 1, stillFrame: reference.frame, browserExecutable: resolve(browserExecutable),
      });
      const repeated = await readFile(join(outputDir, 'api-smoke', `${reference.cardId}.png`));
      if (sha256(repeated) !== reference.sha256) throw new Error('Public renderCards PNG differs from the direct Remotion render. Re-run after concurrent builds settle; otherwise investigate nondeterminism.');
    } catch (error) {
      apiError = message(error);
    }

    /** @type {string[]} */
    const sheets = [];
    /** @param {string} name @param {string} title @param {CaseResult[]} cases */
    async function contactSheets(name, title, cases) {
      const rendered = cases.flatMap((result) => result.image === null ? [] : [{...result, image: result.image}]);
      if (rendered.length === 0) return;
      const tiles = await Promise.all(rendered.map(async (result) => ({
        label: `${result.cardId} · ${result.scenarioId} · f${result.frame}`,
        src: `data:image/png;base64,${(await readFile(join(outputDir, result.image))).toString('base64')}`,
        width: result.width, height: result.height, failed: caseFailed(result),
      })));
      for (const matte of ['dark', 'light']) {
        const inputProps = {title, matte, tiles};
        const composition = await selectComposition({...shared, id: 'visual-contact-sheet', inputProps, logLevel: 'error'});
        const filename = `${name}-${matte}.png`;
        await renderStill({...shared, composition, inputProps, frame: 0, imageFormat: 'png', output: join(outputDir, filename), overwrite: false, logLevel: 'error'});
        sheets.push(filename);
      }
    }
    for (const scenario of scenarios) {
      const lastFrames = selectedCards.flatMap((card) => results.filter((result) => result.cardId === card.id && result.scenarioId === scenario.id).slice(-1));
      await contactSheets(`baseline-${scenario.id}`, `${scenario.id} · last requested frames`, lastFrames);
    }
    const profileIds = selectedCards.filter((card) => card.id.startsWith('readme')).map((card) => card.id);
    if (profileIds.length === 0) profileIds.push(selectedCards[0].id);
    await contactSheets('key-frames', `${scenarios[0].id} · profile key frames`, results.filter((result) => result.scenarioId === scenarios[0].id && profileIds.includes(result.cardId)));

    await writeFile(join(outputDir, 'report.json'), JSON.stringify({fixtureTime, theme, browserExecutable, node: process.version, frames, controls, apiReference: reference?.image ?? null, apiError, results, sheets, pixelReview: 'Not performed by this harness; geometry and byte parity are not visual approval.'}, null, 2));
    await writeFile(join(outputDir, 'index.html'), galleryHtml({results, sheets, fixtureTime, theme, apiError}));
    const failures = results.filter(caseFailed);
    for (const failure of failures) {
      console.error(`FAIL ${failure.scenarioId}/${failure.cardId} f${failure.frame}: ${(failure.error ? [failure.error] : failure.report?.issues ?? []).slice(0, 3).join('\n  ')}`);
    }
    if (apiError) console.error(`FAIL public API parity: ${apiError}`);
    console.log(`${results.length - failures.length}/${results.length} frame checks passed. Gallery: ${join(outputDir, 'index.html')}`);
    console.log('Pixel appearance has not been visually inspected by this text-only harness.');
    if (failures.length > 0 || apiError) process.exitCode = 1;
  } finally {
    try {
      if (browser) await browser.close({silent: true});
    } finally {
      try {
        if (bundleServer) await bundleServer.close();
      } finally {
        // Never remove the selected output root or another invocation's files.
        await rm(workDir, {recursive: true, force: true});
      }
    }
  }
}

main().catch(/** @param {unknown} error */ (error) => {
  console.error(`Graphics verification failed: ${message(error)}`);
  process.exitCode = 1;
});
