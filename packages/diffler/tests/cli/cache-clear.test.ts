import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {stringify} from "yaml";
import {createProgram} from "../../src/cli.js";
import {DifflerConfigSchema} from "../../src/config.js";
import {analyzeTemplate} from "../../src/engine/plan.js";
import {buildProfileStatsConfig, profileExtrasDirectory} from "../../src/engine/paths.js";

vi.mock("dotenv", () => ({config: vi.fn()}));

const cwd = process.cwd();
const environment = process.env;
let directory: string;

beforeEach(() => {
  process.env = {};
  directory = mkdtempSync(join(tmpdir(), "diffler-clear-cache-"));
  process.chdir(directory);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(cwd);
  process.env = environment;
  rmSync(directory, {recursive: true, force: true});
  vi.restoreAllMocks();
});

function write(path: string, content = "cache"): void {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, content);
}

function clear() {
  return createProgram({writeErr: () => {}, writeOut: () => {}})
    .parseAsync(["cache-clear", "--config", "config.yml"], {from: "user"});
}

it("clears each configured account's caches and extras while preserving snapshots", async () => {
  const config = DifflerConfigSchema.parse({
    github: {usernames: ["alice", "bob"]},
    statsAction: {cachePath: "cache/stable.json", volatileCachePath: "volatile/recent.json", outputPath: "data/stats.json"},
    cache: {directory: "extra-cache"},
  });
  write("config.yml", stringify(config));
  const alice = {username: "alice", token: ""};
  const bob = {username: "bob", token: ""};
  const first = buildProfileStatsConfig(analyzeTemplate("{{ stats }}"), config, alice);
  const second = buildProfileStatsConfig(analyzeTemplate("{{ stats }}"), config, bob);
  const orgs = join(profileExtrasDirectory(config, alice), "orgs.json");
  write(first.cachePath);
  write(first.volatileCachePath);
  write(second.cachePath);
  write(second.volatileCachePath);
  write(orgs);
  write(first.outputPath, "account snapshot");
  write(config.statsAction.outputPath, "published snapshot");

  await clear();

  expect([first.cachePath, first.volatileCachePath, second.cachePath, second.volatileCachePath, orgs].map(existsSync)).toEqual([false, false, false, false, false]);
  expect(readFileSync(first.outputPath, "utf8")).toBe("account snapshot");
  expect(readFileSync(config.statsAction.outputPath, "utf8")).toBe("published snapshot");
});

it("honors environment cache paths without requiring collection credentials", async () => {
  write("config.yml", "{}");
  process.env.STATS_CACHE_PATH = "custom/cache.json";
  write("custom/cache.json");
  write(".diffler/stats.json", "published snapshot");

  await clear();

  expect(existsSync("custom/cache.json")).toBe(false);
  expect(readFileSync(".diffler/stats.json", "utf8")).toBe("published snapshot");
});

it("rejects cache/output collisions before deleting anything", async () => {
  write("config.yml", stringify({statsAction: {cachePath: "data.json", outputPath: "data.json"}}));
  write("data.json", "published snapshot");

  await expect(clear()).rejects.toThrow("Cache paths must not overlap");

  expect(readFileSync("data.json", "utf8")).toBe("published snapshot");
});

it("surfaces filesystem errors instead of recursively removing directories", async () => {
  write("config.yml", "{}");
  mkdirSync(".diffler/cache-stable.json", {recursive: true});

  await expect(clear()).rejects.toThrow();

  expect(existsSync(".diffler/cache-stable.json")).toBe(true);
});
