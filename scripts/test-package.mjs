import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fixture = mkdtempSync(join(tmpdir(), "diffler-package-"));
const packages = join(fixture, "packages");
const project = join(fixture, "consumer");

const run = (command, args, cwd = root) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

try {
  run("mkdir", ["-p", packages, project]);
  run("pnpm", ["--dir", "packages/schemas", "pack", "--pack-destination", packages]);
  run("pnpm", ["--dir", "packages/diffler", "pack", "--pack-destination", packages]);
  run("pnpm", ["--dir", "packages/remotion", "pack", "--pack-destination", packages]);

  const packageVersion = JSON.parse(
    readFileSync(join(root, "packages/diffler/package.json"), "utf8")
  ).version;
  const schemaTarball = join(
    packages,
    `lukasparke-diffler-schemas-${packageVersion}.tgz`
  );
  const cliTarball = join(packages, `lukasparke-diffler-${packageVersion}.tgz`);
  const remotionTarball = join(
    packages,
    `lukasparke-diffler-remotion-${packageVersion}.tgz`
  );

  run("npm", ["init", "-y"], project);
  run("npm", ["install", schemaTarball, cliTarball, remotionTarball], project);

  const help = run("npx", ["--no-install", "diffler", "--help"], project);
  if (!help.includes("collect") || !help.includes("render")) {
    throw new Error("Packed CLI help is missing expected commands");
  }

  const version = run("npx", ["--no-install", "diffler", "--version"], project).trim();
  if (version !== packageVersion) {
    throw new Error(`Packed CLI reported ${version}; expected ${packageVersion}`);
  }

  run("npx", ["--no-install", "diffler", "init"], project);
  const rendererWithoutEntryPoint = spawnSync(
    "npx",
    ["--no-install", "github-readme-cards", "--cards", "readme"],
    { cwd: project, encoding: "utf8" }
  );
  if (
    rendererWithoutEntryPoint.status === 0 ||
    !rendererWithoutEntryPoint.stderr.includes("--entry-point is required")
  ) {
    throw new Error(
      "Packed renderer did not expose its CLI or validate the required entry point"
    );
  }
  console.log("Packed CLI and renderer install and run from a clean project.");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
