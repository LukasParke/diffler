import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { createProgram } from "../../src/cli.js";
import { DifflerConfigSchema, loadConfig } from "../../src/config.js";
import { Renderer } from "../../src/core/renderer.js";
import { deriveContext } from "../../src/engine/index.js";
import { collectedStats, FIXED_NOW } from "./fixtures.js";

vi.mock("dotenv", () => ({ config: vi.fn() }));

const originalEnv = process.env;
const originalCwd = process.cwd();
let directory: string;

beforeEach(() => {
  process.env = {};
  directory = mkdtempSync(join(tmpdir(), "diffler-init-"));
  process.chdir(directory);
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(originalCwd);
  process.env = originalEnv;
  rmSync(directory, { recursive: true, force: true });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function run(args: string[]) {
  return createProgram({ writeErr: () => {}, writeOut: () => {} })
    .parseAsync(args, { from: "user" });
}

it("scaffolds the requested template and config directories with environment identity", async () => {
  process.env.DIFFLER_GITHUB_USERNAME = "configured-user";
  process.env.GITHUB_TOKEN = "never-serialize-this-token";

  await run(["init", "--dir", "custom templates", "--config", "settings/profile.yml"]);

  const raw = readFileSync("settings/profile.yml", "utf-8");
  const config: unknown = parseYaml(raw);
  expect(config).toMatchObject({
    github: { username: "configured-user", token: "${GITHUB_TOKEN}" },
    templates: { main: "profile.md.j2", directory: "custom templates" },
    assets: { baseUrl: "./assets", format: "webp" },
  });
  expect(raw).not.toContain("never-serialize-this-token");
  expect(existsSync("custom templates/profile.md.j2")).toBe(true);
  expect(existsSync(".github/diffler")).toBe(false);
});

it("allows an explicit init identity and asset URL without hardcoded profile data", async () => {
  process.env.DIFFLER_GITHUB_USERNAME = "environment-user";

  await run(["init", "--username", "selected-user", "--asset-base-url", "https://example.com/profile"]);

  const config = loadConfig();
  expect(config.github.username).toBe("selected-user");
  expect(config.assets?.baseUrl).toBe("https://example.com/profile");
  const markdown = new Renderer(config).render(deriveContext(collectedStats(), config));
  expect(markdown).toContain("https://example.com/profile/readme.webp");
  expect(markdown).toContain("| Contributions | 7 |");
  expect(markdown).toContain("Fixture User");
  expect(markdown).not.toContain("Python");
  expect(markdown).not.toContain("github-readme-stats");
});

it("leaves an environment placeholder rather than inventing an init username", async () => {
  await run(["init"]);

  const config: unknown = parseYaml(readFileSync(".github/diffler.yml", "utf-8"));
  expect(config).toHaveProperty("github.username", "${DIFFLER_GITHUB_USERNAME}");
  expect(console.log).toHaveBeenCalledWith("Set DIFFLER_GITHUB_USERNAME or github.username before collecting.");
});

it("derives init identity from the repository owner when no explicit username is set", async () => {
  process.env.GITHUB_REPOSITORY_OWNER = "repository-owner";

  await run(["init"]);

  expect(loadConfig().github.username).toBe("repository-owner");
});

it("uses an existing config's template directory and preserves its credentials", async () => {
  const content = stringifyYaml({
    github: { profiles: [{ username: "work-user", token: "work-test-token" }] },
    templates: { directory: "configured-templates", main: "nested/profile.md.j2" },
  });
  writeFileSync("config.yml", content);

  await run(["init", "--config", "config.yml"]);

  expect(readFileSync("config.yml", "utf-8")).toBe(content);
  expect(existsSync("configured-templates/nested/profile.md.j2")).toBe(true);
  expect(existsSync(".github/diffler")).toBe(false);
});

it("does not overwrite an existing user template", async () => {
  process.env.DIFFLER_GITHUB_USERNAME = "fixture-user";
  mkdirSync(".github/diffler", { recursive: true });
  writeFileSync(".github/diffler/profile.md.j2", "My existing profile template\n");

  await run(["init"]);

  expect(readFileSync(".github/diffler/profile.md.j2", "utf-8")).toBe("My existing profile template\n");
});

it("rejects unsafe asset URL options before creating files", async () => {
  await expect(run(["init", "--asset-base-url", "javascript:alert(1)"]))
    .rejects.toMatchObject({ code: "commander.invalidArgument" });

  expect(existsSync(".github/diffler.yml")).toBe(false);
});

it.each([
  "basic/profile.md.j2",
  "advanced/profile.md.j2",
  "readme-example.md.j2",
])("renders %s with generated assets and measured text, not unrelated widgets or skills", (example) => {
  const path = fileURLToPath(new URL(`../../examples/${example}`, import.meta.url));
  const config = DifflerConfigSchema.parse({
    templates: { main: basename(path), directory: dirname(path) },
    assets: { baseUrl: "https://example.com/cards", format: "gif" },
  });

  const markdown = new Renderer(config).render(deriveContext(collectedStats(), config));

  expect(markdown).toContain("https://example.com/cards/readme.gif");
  expect(markdown).toContain("Fixture User");
  expect(markdown).toContain("7");
  expect(markdown).not.toContain("Python");
  expect(markdown).not.toContain("github-readme-stats");
  expect(markdown).not.toContain("LukasParke");
});

it("does not expose private repositories in the default README", async () => {
  process.env.DIFFLER_GITHUB_USERNAME = "fixture-user";
  await run(["init"]);
  const config = loadConfig();
  const stats = collectedStats();
  stats.repositories.push({
    ...stats.repositories[0], id: "private-id", name: "private-project",
    nameWithOwner: "fixture-user/private-project", isPrivate: true,
  });

  const markdown = new Renderer(config).render(deriveContext(stats, config));

  expect(markdown).toContain("profile-tools");
  expect(markdown).not.toContain("private-project");
});

it("provides text fallback instead of presenting an incomplete snapshot as measured statistics", async () => {
  await run(["init", "--username", "fixture-user"]);
  const config = loadConfig();
  const stats = collectedStats();
  stats.collectionStatus.coreComplete = false;
  stats.collectionStatus.complete = false;

  const markdown = new Renderer(config).render(deriveContext(stats, config));

  expect(markdown).toContain("A complete activity snapshot is not available yet.");
  expect(markdown).toContain("https://github.com/fixture-user");
  expect(markdown).not.toContain("| Contributions |");
});
