import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { githubStatsOutputSchema } from "@lukasparke/diffler-schemas";
import { createProgram } from "../../src/cli.js";
import { UnifiedEngine } from "../../src/engine/index.js";
import { collectedStats, FIXED_NOW } from "./fixtures.js";

vi.mock("dotenv", () => ({ config: vi.fn() }));

const originalCwd = process.cwd();
const originalEnv = process.env;
let directory: string;

beforeEach(() => {
  process.env = {};
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  vi.spyOn(console, "log").mockImplementation(() => {});
  directory = mkdtempSync(join(tmpdir(), "diffler-collect-"));
  process.chdir(directory);
});

afterEach(() => {
  process.chdir(originalCwd);
  process.env = originalEnv;
  rmSync(directory, { recursive: true, force: true });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("persists the final multi-profile aggregate at the CLI output path, not a last-account snapshot", async () => {
  process.env.STATS_OUTPUT_PATH = "environment.json";
  writeFileSync("config.yml", stringifyYaml({
    github: { profiles: [
      { username: "fixture-user", token: "personal-test-token" },
      { username: "work-user", token: "work-test-token" },
    ] },
    statsAction: { outputPath: "configured.json", backfillMode: "off" },
  }));
  const personal = collectedStats();
  const work = collectedStats();
  work.profile.login = "work-user";
  work.profile.name = "Work User";
  vi.spyOn(UnifiedEngine.prototype, "collect")
    .mockResolvedValueOnce({ output: personal, extras: {} })
    .mockResolvedValueOnce({ output: work, extras: {} });

  await createProgram().parseAsync([
    "collect", "--config", "config.yml", "--output-path", "data/aggregate.json",
  ], { from: "user" });

  const content = readFileSync("data/aggregate.json", "utf-8");
  const stats = githubStatsOutputSchema.parse(JSON.parse(content));
  expect(stats.profile.login).toBe("fixture-user");
  expect(stats.profileContributions.totalContributions).toBe(14);
  expect(stats.profileContributions.contributionCalendar.weeks[0].contributionDays).toEqual([
    { date: "2025-01-14", contributionCount: 6 },
    { date: "2025-01-15", contributionCount: 8 },
  ]);
  expect(stats.repoMetrics.starCount).toBe(6);
  expect(stats.repositories).toHaveLength(1);
  expect(content).not.toContain("personal-test-token");
  expect(content).not.toContain("work-test-token");
});
