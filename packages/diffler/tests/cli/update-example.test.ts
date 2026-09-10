import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectProfiles } from "../../src/engine/index.js";
import { collectedStats, FIXED_NOW } from "./fixtures.js";

// The repository script imports built entry points; exercise the current source in tests.
vi.mock("../../dist/config.js", () => import("../../src/config.js"));
vi.mock("../../dist/core/engine.js", () => import("../../src/core/engine.js"));
vi.mock("../../dist/core/renderer.js", () => import("../../src/core/renderer.js"));
vi.mock("../../src/engine/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/engine/index.js")>();
  return { ...actual, collectProfiles: vi.fn() };
});
vi.mock("dotenv", () => ({ config: vi.fn() }));

const originalCwd = process.cwd();
const originalArgv = process.argv;
const originalEnv = process.env;
const originalExitCode = process.exitCode;
const scriptUrl = new URL("../../scripts/update-readme-example.js", import.meta.url).href;
let directory: string;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  vi.spyOn(console, "log").mockImplementation(() => {});
  process.env = {};
  process.exitCode = undefined;
  directory = mkdtempSync(join(tmpdir(), "diffler-example-"));
  process.chdir(directory);
  process.argv = ["node", "update-readme-example.js", "--config", "config.yml", "--readme", "example.md"];
  writeFileSync("config.yml", [
    "github:", "  username: fixture-user", "  token: fixture-token",
    "templates:", "  main: different.md.j2", "  directory: .",
    "assets:", "  baseUrl: https://example.com/profile",
  ].join("\n"));
  writeFileSync("different.md.j2", "This is not the README example template.");
  vi.mocked(collectProfiles).mockReset().mockResolvedValue({ output: collectedStats(), extras: {} });
});

afterEach(() => {
  process.chdir(originalCwd);
  process.argv = originalArgv;
  process.env = originalEnv;
  process.exitCode = originalExitCode;
  rmSync(directory, { recursive: true, force: true });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("updates only the example markers using the package-relative example template", async () => {
  writeFileSync("example.md", "Before\n<!-- DIFFLER_EXAMPLE_START -->\nOld content\n<!-- DIFFLER_EXAMPLE_END -->\nAfter\n");

  await import(scriptUrl);

  await vi.waitFor(() => expect(readFileSync("example.md", "utf-8")).toContain("# Fixture User"));
  const readme = readFileSync("example.md", "utf-8");
  expect(readme).toContain("https://example.com/profile/readme.webp");
  expect(readme).toContain("| Contributions | 7 |");
  expect(readme).toMatch(/^Before\n<!-- DIFFLER_EXAMPLE_START -->/);
  expect(readme).toMatch(/<!-- DIFFLER_EXAMPLE_END -->\nAfter\n$/);
  expect(readme).not.toContain("This is not the README example template.");
  expect(readme).not.toContain("fixture-token");
});

it("skips collection and leaves the README unchanged when example markers are missing", async () => {
  writeFileSync("example.md", "README without example markers\n");

  await import(scriptUrl);

  expect(collectProfiles).not.toHaveBeenCalled();
  expect(readFileSync("example.md", "utf-8")).toBe("README without example markers\n");
});
