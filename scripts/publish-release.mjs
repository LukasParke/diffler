import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const packages = [
  'packages/schemas',
  'packages/diffler',
  'packages/remotion',
].map((directory) => {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  return {directory, name: manifest.name, version: manifest.version};
});

const tagArgumentIndex = process.argv.indexOf('--tag');
const requestedTag =
  (tagArgumentIndex >= 0 ? process.argv[tagArgumentIndex + 1] : undefined) ||
  process.env.GITHUB_REF_NAME;
const versions = new Set(packages.map((pkg) => pkg.version));

if (versions.size !== 1) {
  throw new Error(
    `Workspace package versions must match: ${packages
      .map((pkg) => `${pkg.name}@${pkg.version}`)
      .join(', ')}`
  );
}

const version = packages[0].version;
if (requestedTag !== `v${version}`) {
  throw new Error(`Release tag ${requestedTag || '<missing>'} must equal v${version}`);
}

if (!process.env.NODE_AUTH_TOKEN) {
  throw new Error('NODE_AUTH_TOKEN is required to publish a release');
}

const unpublished = packages.filter((pkg) => !isPublished(pkg.name, pkg.version));
if (unpublished.length === 0) {
  console.log(`All packages for v${version} are already published.`);
  process.exit(0);
}

console.log(
  `Publishing ${unpublished.map((pkg) => `${pkg.name}@${pkg.version}`).join(', ')}`
);
for (const pkg of unpublished) {
  execFileSync(
    'pnpm',
    ['--filter', pkg.name, 'publish', '--no-git-checks', '--provenance'],
    {stdio: 'inherit'}
  );
}

function isPublished(name, packageVersion) {
  const result = spawnSync('npm', ['view', `${name}@${packageVersion}`, 'version'], {
    encoding: 'utf8',
  });
  if (result.status === 0) {
    return result.stdout.trim() === packageVersion;
  }
  if (result.stderr.includes('E404')) {
    return false;
  }
  throw new Error(`Could not check ${name}@${packageVersion}: ${result.stderr.trim()}`);
}
