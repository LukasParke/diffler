import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'diffler-consumer-'));
const consumer = join(temporary, 'consumer with spaces');
const tarballs = join(temporary, 'packages');
const require = createRequire(new URL('../packages/remotion/package.json', import.meta.url));
const env = {...process.env, CI: 'true'};
// Packaging tests never need credentials, even if invoked from a developer shell.
for (const key of Object.keys(env)) {
  if (/TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|API_KEY|PRIVATE_KEY|^STATS_|^DIFFLER_/i.test(key)) delete env[key];
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit'});
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed (exit ${result.status})`);
}

try {
  await mkdir(tarballs, {recursive: true});
  await mkdir(consumer);
  for (const name of ['schemas', 'remotion', 'diffler']) {
    run('pnpm', ['pack', '--pack-destination', tarballs], join(root, 'packages', name));
  }
  const archives = await readdir(tarballs);
  const archive = async (directory) => {
    const {name, version} = JSON.parse(await readFile(join(root, 'packages', directory, 'package.json'), 'utf8'));
    const file = `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;
    assert.ok(archives.includes(file), `Missing tarball for ${name}; run pnpm build first`);
    return `file:${join(tarballs, file)}`;
  };
  const dependencies = {
    '@lukasparke/diffler-schemas': await archive('schemas'),
    '@lukasparke/diffler-remotion': await archive('remotion'),
    '@lukasparke/diffler': await archive('diffler'),
    react: '18.3.1',
    'react-dom': '18.3.1',
    remotion: '4.0.509',
    zod: '4.4.3',
  };
  // These are consumer type-checking tools, not unpublished workspace build tools.
  const devDependencies = Object.fromEntries(
    ['@types/node', '@types/react', '@types/react-dom'].map((name) => [name, require(`${name}/package.json`).version]),
  );
  await writeFile(join(consumer, 'package.json'), JSON.stringify({
    name: 'diffler-packed-consumer-smoke',
    version: '1.0.0',
    private: true,
    type: 'module',
    packageManager: 'pnpm@10.34.5',
    dependencies,
    devDependencies,
    pnpm: {overrides: {'@lukasparke/diffler-schemas': dependencies['@lukasparke/diffler-schemas']}},
  }, null, 2));
  await writeFile(join(consumer, '.npmrc'), 'auto-install-peers=false\nstrict-peer-dependencies=true\nengine-strict=true\n');
  // Install tarballs outside the workspace: no source aliases, hoisted CLI, or workspace links.
  run('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile', '--reporter=append-only', '--fetch-retries=0', '--fetch-timeout=15000'], consumer);
  run('pnpm', ['exec', 'github-readme-cards', '--help'], consumer);

  await cp(join(root, 'examples/remotion-usage/src'), join(consumer, 'src'), {recursive: true});
  for (const file of ['consumer-smoke-checks.mjs', 'consumer-smoke-entry.tsx']) {
    await cp(join(root, 'scripts', file), join(consumer, file));
  }
  const declarations = `
import * as core from '@lukasparke/diffler-remotion';
import * as themes from '@lukasparke/diffler-remotion/themes';
import {cards} from '@lukasparke/diffler-remotion/cards';
import {renderCards} from '@lukasparke/diffler-remotion/render';
import {userStatsSchema} from '@lukasparke/diffler-schemas/zod';
import * as v2 from '@lukasparke/diffler-schemas/v2';
import '@lukasparke/diffler-remotion/styles.css';
const props: core.MainProps = {userStats: userStatsSchema.parse(core.defaultStats)};
const theme: themes.Theme = themes.defaultTheme;
void [props, theme, cards, renderCards, v2];
`;
  await writeFile(join(consumer, 'types.mts'), declarations);
  await writeFile(join(consumer, 'types.cts'), declarations
    .replace("import * as core from '@lukasparke/diffler-remotion';", "import core = require('@lukasparke/diffler-remotion');")
    .replace("import * as themes from '@lukasparke/diffler-remotion/themes';", "import themes = require('@lukasparke/diffler-remotion/themes');"));
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      strict: true, noEmit: true, skipLibCheck: true, noUncheckedSideEffectImports: true,
    },
    include: ['types.mts', 'types.cts'],
  }));
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json'], consumer);

  const profile = join(consumer, 'profile project');
  await mkdir(profile);
  run(process.execPath, [join(consumer, 'node_modules/@lukasparke/diffler/dist/cli.js'), 'init', '--username', 'diffler-demo', '--dir', 'templates', '--config', 'diffler.yml'], profile);
  assert.match(await readFile(join(profile, 'diffler.yml'), 'utf8'), /templates:/);
  assert.match(await readFile(join(profile, 'templates/profile.md.j2'), 'utf8'), /github/);
  assert.ok((await readFile(join(consumer, 'node_modules/@lukasparke/diffler/templates/builtins/default.md.j2'))).length > 0);

  run(process.execPath, ['consumer-smoke-checks.mjs', ...(process.argv.includes('--render') ? ['--render', join(root, 'artifacts/consumer-smoke')] : [])], consumer);
  console.log('Packed consumer smoke passed: ESM, CJS, declarations, CLI CWD, styles/fonts, and example bundle.');
} finally {
  await rm(temporary, {recursive: true, force: true});
}
