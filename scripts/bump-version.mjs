import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Bumps all publishable packages to the same version in lockstep (the publish
// script enforces this) and refreshes the lockfile.
// Usage: node scripts/bump-version.mjs 1.0.0

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("Usage: node scripts/bump-version.mjs <version> (e.g. 1.0.0)");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const packageDirs = ["packages/schemas", "packages/diffler", "packages/remotion"];

for (const directory of packageDirs) {
  const manifestPath = resolve(root, directory, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  // workspace:* ranges resolve at publish time; only the version field changes.
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${manifest.name} -> ${version}`);
}

execSync("pnpm install --no-frozen-lockfile", { cwd: root, stdio: "inherit" });
console.log(`\nNext: commit, tag v${version}, and push the tag to trigger the release workflow.`);
