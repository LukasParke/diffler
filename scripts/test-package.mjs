import { execFileSync } from "node:child_process";
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

  const schemaTarball = join(packages, "lukasparke-diffler-schemas-0.1.0.tgz");
  const cliTarball = join(packages, "lukasparke-diffler-0.1.0.tgz");

  run("npm", ["init", "-y"], project);
  run("npm", ["install", schemaTarball, cliTarball], project);

  const help = run("npx", ["--no-install", "diffler", "--help"], project);
  if (!help.includes("collect") || !help.includes("render")) {
    throw new Error("Packed CLI help is missing expected commands");
  }

  const version = run("npx", ["--no-install", "diffler", "--version"], project).trim();
  const packageVersion = JSON.parse(
    readFileSync(join(root, "packages/diffler/package.json"), "utf8")
  ).version;
  if (version !== packageVersion) {
    throw new Error(`Packed CLI reported ${version}; expected ${packageVersion}`);
  }

  run("npx", ["--no-install", "diffler", "init"], project);
  console.log("Packed CLI installs and runs from a clean project.");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
