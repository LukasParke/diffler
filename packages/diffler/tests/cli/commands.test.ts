import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { presentationSchema, sourcePropsSchema } from "@lukasparke/diffler-schemas";
import { createProgram, runCli } from "../../src/cli.js";
import { buildStatsActionConfig, getProfiles } from "../../src/config.js";
import { collectProfiles } from "../../src/engine/index.js";
import { collectedStats, FIXED_NOW } from "./fixtures.js";

vi.mock("../../src/engine/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/engine/index.js")>();
  return { ...actual, collectProfiles: vi.fn() };
});
vi.mock("dotenv", () => ({ config: vi.fn() }));

const originalEnv = process.env;
const originalCwd = process.cwd();
const originalExitCode = process.exitCode;
let directory: string;

beforeEach(() => {
  process.env = {};
  process.exitCode = undefined;
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  directory = mkdtempSync(join(tmpdir(), "diffler-cli-"));
  process.chdir(directory);
  writeFileSync("config.yml", stringifyYaml({
    github: { username: "fixture-user", token: "fixture-token" },
    templates: { main: "missing-template.md.j2", directory: "missing-templates" },
  }));
  vi.mocked(collectProfiles).mockReset().mockResolvedValue({ output: collectedStats(), extras: {} });
});

afterEach(() => {
  process.chdir(originalCwd);
  process.env = originalEnv;
  process.exitCode = originalExitCode;
  rmSync(directory, { recursive: true, force: true });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function run(args: string[]) {
  return createProgram({ writeErr: () => {}, writeOut: () => {} })
    .parseAsync(args, { from: "user" });
}

it("collects with config credentials when GITHUB_TOKEN is absent", async () => {
  await run(["collect", "--config", "config.yml"]);

  expect(collectProfiles).toHaveBeenCalledOnce();
  const [plan, config] = vi.mocked(collectProfiles).mock.calls[0];
  expect(getProfiles(config.github)).toEqual([{ username: "fixture-user", token: "fixture-token" }]);
  expect(plan).toMatchObject({
    needsProfile: true,
    needsRepositories: true,
    needsContributions: true,
    needsTraffic: true,
    needsContributorStats: true,
  });
});

it("passes all configured profiles and their own credentials to the aggregate collector", async () => {
  writeFileSync("config.yml", stringifyYaml({
    github: {
      username: "ignored-user",
      token: "unused-global-token",
      profiles: [
        { username: "fixture-user", token: "personal-token" },
        { username: "work-user", token: "work-token" },
      ],
    },
  }));

  await run(["collect", "--config", "config.yml"]);

  expect(collectProfiles).toHaveBeenCalledOnce();
  expect(getProfiles(vi.mocked(collectProfiles).mock.calls[0][1].github)).toEqual([
    { username: "fixture-user", token: "personal-token" },
    { username: "work-user", token: "work-token" },
  ]);
});

it("applies CLI paths, backfill, and privacy settings ahead of environment defaults", async () => {
  process.env.STATS_OUTPUT_PATH = "environment.json";
  process.env.STATS_BACKFILL_MODE = "resume";

  await run([
    "collect", "--config", "config.yml", "--output-path", "data/aggregate.json",
    "--cache-path", "cache/stable.json", "--volatile-cache-path", "cache/volatile.json",
    "--backfill-mode", "off", "--include-private",
  ]);

  const config = buildStatsActionConfig(vi.mocked(collectProfiles).mock.calls[0][1]);
  expect(config).toMatchObject({
    outputPath: "data/aggregate.json",
    cachePath: "cache/stable.json",
    volatileCachePath: "cache/volatile.json",
    backfillMode: "off",
    includePrivateRepositoryDetails: true,
    includePrivateCacheDetails: true,
  });
  expect(process.env.STATS_OUTPUT_PATH).toBe("environment.json");
});

it("rejects invalid CLI backfill modes before collecting", async () => {
  await expect(run(["collect", "--config", "config.yml", "--backfill-mode", "restart"]))
    .rejects.toMatchObject({ code: "commander.invalidArgument" });

  expect(collectProfiles).not.toHaveBeenCalled();
});

it("rejects empty CLI output paths before collecting", async () => {
  await expect(run(["collect", "--config", "config.yml", "--output-path", "   "]))
    .rejects.toMatchObject({ code: "commander.invalidArgument" });

  expect(collectProfiles).not.toHaveBeenCalled();
});

it("rejects unknown options rather than silently ignoring them", async () => {
  await expect(run(["export-remotion", "--theme", "dark"]))
    .rejects.toMatchObject({ code: "commander.unknownOption" });

  expect(collectProfiles).not.toHaveBeenCalled();
});

it("rejects invalid default config instead of collecting with environment fallback", async () => {
  process.env.GITHUB_TOKEN = "environment-token";
  process.env.DIFFLER_GITHUB_USERNAME = "environment-user";
  mkdirSync(".github");
  writeFileSync(".github/diffler.yml", "statsAction:\n  backfillMode: invalid\n");

  await expect(run(["collect"])).rejects.toThrow("statsAction.backfillMode");
  expect(collectProfiles).not.toHaveBeenCalled();
});

it("reports a missing profile token without requiring a global token for other profiles", async () => {
  writeFileSync("config.yml", stringifyYaml({
    github: { profiles: [
      { username: "fixture-user", token: "valid-personal-token" },
      { username: "work-user", token: "${MISSING_WORK_TOKEN}" },
    ] },
  }));

  await expect(run(["collect", "--config", "config.yml"]))
    .rejects.toThrow("A GitHub token is required for profile work-user");
  expect(collectProfiles).not.toHaveBeenCalled();
});

it("does not invent an identity for collection", async () => {
  writeFileSync("config.yml", "github:\n  token: configured-token\n");

  await expect(run(["collect", "--config", "config.yml"]))
    .rejects.toThrow("Configure a GitHub username or profiles");
  expect(collectProfiles).not.toHaveBeenCalled();
});

it("exports canonical inline SourceProps without requiring a README template", async () => {
  await run(["export-remotion", "--config", "config.yml"]);

  const input = sourcePropsSchema.parse(JSON.parse(readFileSync("remotion-input.json", "utf-8")));
  expect(input).toEqual({
    username: "fixture-user",
    stats: collectedStats(),
    allowPrivateRepositoryDetails: false,
  });
});

it("keeps the legacy --target command byte-equivalent to the canonical export", async () => {
  await run(["export-remotion", "--config", "config.yml", "--output", "new/input.json"]);
  await run(["export-remotion-input", "--config", "config.yml", "--target", "legacy/input.json"]);

  expect(readFileSync("legacy/input.json", "utf-8")).toBe(readFileSync("new/input.json", "utf-8"));
});

it("accepts --output on the legacy export wrapper", async () => {
  await run(["export-remotion-input", "--config", "config.yml", "--output", "local/input.json"]);

  expect(sourcePropsSchema.parse(JSON.parse(readFileSync("local/input.json", "utf-8"))).username)
    .toBe("fixture-user");
});

it("rejects ambiguous simultaneous --output and --target paths", async () => {
  await expect(run([
    "export-remotion-input", "--config", "config.yml",
    "--output", "first.json", "--target", "second.json",
  ])).rejects.toMatchObject({ code: "commander.conflictingOption" });

  expect(collectProfiles).not.toHaveBeenCalled();
});

it("exports only public repository details by default even when the environment opts into private data", async () => {
  process.env.STATS_INCLUDE_PRIVATE_REPOSITORY_DETAILS = "true";

  await run(["export-remotion", "--config", "config.yml"]);

  const config = buildStatsActionConfig(vi.mocked(collectProfiles).mock.calls[0][1]);
  expect(config.includePrivateRepositoryDetails).toBe(false);
  expect(sourcePropsSchema.parse(JSON.parse(readFileSync("remotion-input.json", "utf-8"))).allowPrivateRepositoryDetails)
    .toBe(false);
});

it("requires explicit --allow-private for private collection and renderer input", async () => {
  const stats = collectedStats();
  stats.privacy.privateRepositoryDetailsIncluded = true;
  vi.mocked(collectProfiles).mockResolvedValue({ output: stats, extras: {} });

  await run(["export-remotion", "--config", "config.yml", "--allow-private"]);

  expect(buildStatsActionConfig(vi.mocked(collectProfiles).mock.calls[0][1]).includePrivateRepositoryDetails).toBe(true);
  expect(sourcePropsSchema.parse(JSON.parse(readFileSync("remotion-input.json", "utf-8"))).allowPrivateRepositoryDetails)
    .toBe(true);
});

it("does not serialize config or credentials alongside multi-profile stats", async () => {
  writeFileSync("config.yml", stringifyYaml({
    github: { profiles: [
      { username: "fixture-user", token: "personal-test-token" },
      { username: "work-user", token: "work-test-token" },
    ] },
  }));

  await run(["export-remotion", "--config", "config.yml"]);

  const content = readFileSync("remotion-input.json", "utf-8");
  const input: unknown = JSON.parse(content);
  expect(input).not.toHaveProperty("config");
  expect(input).not.toHaveProperty("usernames");
  expect(content).not.toContain("personal-test-token");
  expect(content).not.toContain("work-test-token");
});

it("reports asynchronous command failures without dumping configured credentials", async () => {
  vi.mocked(collectProfiles).mockRejectedValue(new Error("Request failed with fixture-token"));

  await runCli(["node", "diffler", "export-remotion", "--config", "config.yml"]);

  expect(process.exitCode).toBe(1);
  expect(console.error).toHaveBeenCalledWith("Error: Request failed with [REDACTED]");
  expect(existsSync("remotion-input.json")).toBe(false);
});

it("keeps all advertised command entry points available", () => {
  expect(createProgram().commands.map((command) => command.name())).toEqual([
    "init", "collect", "render", "validate", "update", "cache-clear",
    "export-remotion", "export-remotion-scenes", "export-remotion-input",
  ]);
});

it("exports shared card metadata without unsupported renderer overrides", async () => {
  await run(["export-remotion-scenes", "--config", "config.yml", "--output", "metadata/scenes.json"]);

  const metadata = presentationSchema.shape.remotion.parse(JSON.parse(readFileSync("metadata/scenes.json", "utf-8")));
  expect(metadata.scenes.map((scene) => scene.id)).toEqual([
    "readme", "activity-overview", "repo-impact", "languages",
  ]);
  expect(readFileSync("metadata/scenes.json", "utf-8")).not.toContain('"theme"');
  expect(readFileSync("metadata/scenes.json", "utf-8")).not.toContain('"config"');
});
