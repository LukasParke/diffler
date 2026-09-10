import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildStatsActionConfig,
  DifflerConfigSchema,
  getProfiles,
  getUsernames,
  loadConfig,
  loadConfigFromEnv,
  loadConfigFromFile,
  withStatsActionOverrides,
} from "../src/config.js";

vi.mock("dotenv", () => ({ config: vi.fn() }));

const originalEnv = process.env;
const originalCwd = process.cwd();
let directory: string;

beforeEach(() => {
  process.env = {};
  directory = mkdtempSync(join(tmpdir(), "diffler-config-"));
  mkdirSync(join(directory, ".github"));
  process.chdir(directory);
});

afterEach(() => {
  process.chdir(originalCwd);
  process.env = originalEnv;
  rmSync(directory, { recursive: true, force: true });
});

it("retains the existing config defaults without requiring asset settings", () => {
  const config = loadConfigFromEnv();

  expect(config.version).toBe("1");
  expect(config.github.apiUrl).toBe("https://api.github.com");
  expect(config.templates.main).toBe("profile.md.j2");
  expect(config.cache.enabled).toBe(true);
  expect(config.statsAction.includePrivateRepositoryMetrics).toBe(false);
  expect(config.statsAction.packageSources).toEqual([]);
  expect(config.assets).toBeUndefined();
});

it("enables anonymous private metrics without opting into private details", () => {
  process.env.STATS_INCLUDE_PRIVATE_REPOSITORY_METRICS = "true";
  const config = buildStatsActionConfig(loadConfigFromEnv());
  expect(config.includePrivateRepositoryMetrics).toBe(true);
  expect(config.includePrivateRepositoryDetails).toBe(false);
  expect(config.includePrivateCacheDetails).toBe(false);
});

it("configures npm package stats from the environment", () => {
  process.env.STATS_NPM_PACKAGES = "@lukasparke/diffler, @lukasparke/diffler-remotion";
  expect(buildStatsActionConfig(loadConfigFromEnv()).packageSources).toEqual([{
    provider: "npm", packages: ["@lukasparke/diffler", "@lukasparke/diffler-remotion"],
  }]);
});

it("reads a YAML config file", () => {
  writeFileSync("config.yml", 'github:\n  username: testuser\ntemplates:\n  main: custom.md.j2\n');

  const config = loadConfigFromFile("config.yml");

  expect(config.github.username).toBe("testuser");
  expect(config.templates.main).toBe("custom.md.j2");
});

it("preserves intentional spaces in configured filesystem paths", () => {
  writeFileSync("config.yml", 'templates:\n  directory: " templates "\nstatsAction:\n  outputPath: " stats.json "\n');

  const config = loadConfigFromFile("config.yml");

  expect(config.templates.directory).toBe(" templates ");
  expect(config.statsAction.outputPath).toBe(" stats.json ");
});

it("falls back to environment credentials only when the default config is missing", () => {
  process.env.DIFFLER_GITHUB_USERNAME = "env-user";
  process.env.GITHUB_TOKEN = "env-token";

  expect(getProfiles(loadConfig().github)).toEqual([
    { username: "env-user", token: "env-token" },
  ]);
});

it("does not fall back when an explicit config path is missing", () => {
  process.env.GITHUB_TOKEN = "env-token";

  expect(() => loadConfig("missing.yml")).toThrow("ENOENT");
});

it("rejects an explicitly empty config path instead of treating it as a missing default file", () => {
  expect(() => loadConfig("")).toThrow("Config file path must not be empty");
});

it("rejects an invalid default config instead of falling back to environment credentials", () => {
  process.env.GITHUB_TOKEN = "env-token";
  writeFileSync(".github/diffler.yml", "statsAction:\n  backfillMode: invalid\n");

  expect(() => loadConfig()).toThrow(
    "Invalid Diffler config: statsAction.backfillMode: expected one of resume, refresh, off"
  );
});

it("reports malformed YAML without echoing credential-bearing source", () => {
  writeFileSync(".github/diffler.yml", 'github:\n  token: ["private-test-token"\n');

  expect(() => loadConfig()).toThrow(new Error(
    "Invalid YAML in Diffler config file: .github/diffler.yml"
  ));
});

it("does not fall back on default config filesystem errors other than a missing file", () => {
  mkdirSync(".github/diffler.yml");

  expect(() => loadConfig()).toThrow("EISDIR");
});

it("resolves the default token for file configs that omit github.token", () => {
  process.env.GITHUB_TOKEN = "default-env-token";
  writeFileSync("config.yml", "github:\n  username: testuser\n");

  expect(getProfiles(loadConfigFromFile("config.yml").github)).toEqual([
    { username: "testuser", token: "default-env-token" },
  ]);
});

it("uses profile-specific credentials without a global environment token", () => {
  process.env.GH_PERSONAL = "personal-token";
  process.env.GH_WORK = "work-token";
  writeFileSync("config.yml", [
    "github:",
    "  profiles:",
    "    - username: personal",
    '      token: "${GH_PERSONAL}"',
    "    - username: work",
    '      token: "${GH_WORK}"',
  ].join("\n"));

  expect(getProfiles(loadConfigFromFile("config.yml").github)).toEqual([
    { username: "personal", token: "personal-token" },
    { username: "work", token: "work-token" },
  ]);
});

it("inherits a configured global token only for profiles without their own token", () => {
  process.env.GITHUB_TOKEN = "unused-env-token";
  writeFileSync("config.yml", [
    "github:",
    "  token: configured-token",
    "  profiles:",
    "    - username: personal",
    "    - username: work",
    "      token: work-token",
  ].join("\n"));

  expect(getProfiles(loadConfigFromFile("config.yml").github)).toEqual([
    { username: "personal", token: "configured-token" },
    { username: "work", token: "work-token" },
  ]);
});

it("prefers profiles to usernames and a single username", () => {
  const config = DifflerConfigSchema.parse({
    github: {
      username: "ignored",
      usernames: ["also-ignored"],
      profiles: [{ username: "personal", token: "personal-token" }],
    },
  });

  expect(getProfiles(config.github)).toEqual([
    { username: "personal", token: "personal-token" },
  ]);
});

it("uses the global token for the legacy usernames array", () => {
  const config = DifflerConfigSchema.parse({
    github: { usernames: ["alice", "bob"], token: "global-token" },
  });

  expect(getProfiles(config.github)).toEqual([
    { username: "alice", token: "global-token" },
    { username: "bob", token: "global-token" },
  ]);
});

it("uses the global token for a legacy single username", () => {
  const config = DifflerConfigSchema.parse({
    github: { username: "alice", token: "global-token" },
  });

  expect(getProfiles(config.github)).toEqual([{ username: "alice", token: "global-token" }]);
});

it("does not invent a username when none is configured", () => {
  const config = loadConfigFromEnv();

  expect(getProfiles(config.github)).toEqual([]);
  expect(getUsernames(config.github)).toEqual([]);
});

it("derives environment-only identity from the repository owner", () => {
  process.env.GITHUB_REPOSITORY_OWNER = "repository-owner";

  expect(loadConfigFromEnv().github.username).toBe("repository-owner");
});

it("prefers an explicit environment username over the repository owner", () => {
  process.env.DIFFLER_GITHUB_USERNAME = "selected-user";
  process.env.GITHUB_REPOSITORY_OWNER = "repository-owner";

  expect(loadConfigFromEnv().github.username).toBe("selected-user");
});

it("accepts environment template and asset directories", () => {
  process.env.DIFFLER_TEMPLATE_MAIN = "custom.md.j2";
  process.env.DIFFLER_TEMPLATE_DIRECTORY = "profile-templates";
  process.env.DIFFLER_ASSET_BASE_URL = "https://example.com/profile";

  const config = loadConfigFromEnv();

  expect(config.templates).toEqual({ main: "custom.md.j2", directory: "profile-templates", builtins: true });
  expect(config.assets).toEqual({ baseUrl: "https://example.com/profile", format: "webp" });
});

it("fills an omitted file identity from environment while retaining configured credentials", () => {
  process.env.DIFFLER_GITHUB_USERNAME = "environment-user";
  writeFileSync("config.yml", "github:\n  token: configured-token\n");

  expect(getProfiles(loadConfigFromFile("config.yml").github)).toEqual([
    { username: "environment-user", token: "configured-token" },
  ]);
});

it("lets legacy file configs use an environment asset URL without changing configured identity", () => {
  process.env.DIFFLER_GITHUB_USERNAME = "ignored-user";
  process.env.DIFFLER_ASSET_BASE_URL = "https://example.com/profile";
  writeFileSync("config.yml", "github:\n  username: configured-user\n  token: configured-token\n");

  const config = loadConfigFromFile("config.yml");

  expect(config.github.username).toBe("configured-user");
  expect(config.assets).toEqual({ baseUrl: "https://example.com/profile", format: "webp" });
});

it.each(["graphqlConcurrency: 0", "restConcurrency: 1.5", "maxRuntimeSeconds: -1"])(
  "rejects invalid collection limits: %s",
  (setting) => {
    writeFileSync("config.yml", `statsAction:\n  ${setting}\n`);

    expect(() => loadConfigFromFile("config.yml")).toThrow("Invalid Diffler config:");
  }
);

it("rejects an unresolved username placeholder", () => {
  writeFileSync("config.yml", 'github:\n  username: "${MISSING_USERNAME}"\n');

  expect(() => loadConfigFromFile("config.yml")).toThrow("github.username");
});

it("rejects an invalid environment backfill mode without echoing its value", () => {
  process.env.STATS_BACKFILL_MODE = "private-test-token";

  expect(() => buildStatsActionConfig(loadConfigFromEnv())).toThrow(new Error(
    "Invalid Diffler config: backfillMode: expected one of resume, refresh, off"
  ));
});

it("rejects an invalid environment boolean", () => {
  process.env.STATS_INCLUDE_TRAFFIC = "maybe";

  expect(() => buildStatsActionConfig(loadConfigFromEnv())).toThrow(
    "Invalid STATS_INCLUDE_TRAFFIC: expected a boolean"
  );
});

it("rejects an invalid environment concurrency instead of silently using its default", () => {
  process.env.STATS_GRAPHQL_CONCURRENCY = "not-a-number";

  expect(() => buildStatsActionConfig(loadConfigFromEnv())).toThrow("graphqlConcurrency");
});

it("accepts false environment booleans and zero rate-limit thresholds", () => {
  process.env.STATS_INCLUDE_TRAFFIC = "false";
  process.env.STATS_MIN_GRAPHQL_REMAINING = "0";

  const config = buildStatsActionConfig(loadConfigFromEnv());

  expect(config.includeTraffic).toBe(false);
  expect(config.minGraphqlRemaining).toBe(0);
});

it("keeps explicit CLI settings ahead of environment settings throughout collection", () => {
  process.env.STATS_OUTPUT_PATH = "environment.json";
  process.env.STATS_INCLUDE_PRIVATE_REPOSITORY_DETAILS = "true";
  const config = withStatsActionOverrides(loadConfigFromEnv(), {
    outputPath: "command.json",
    includePrivateRepositoryDetails: false,
  });

  expect(buildStatsActionConfig(config).outputPath).toBe("command.json");
  expect(buildStatsActionConfig(config).includePrivateRepositoryDetails).toBe(false);
});

it("rejects credential-bearing asset URLs without echoing credentials", () => {
  writeFileSync("config.yml", "assets:\n  baseUrl: https://user:private-test-token@example.com\n");

  expect(() => loadConfigFromFile("config.yml")).toThrow(new Error(
    "Invalid Diffler config: assets.baseUrl: Expected an HTTP(S) URL or a relative asset directory, without credentials, query, or fragment"
  ));
});

it("rejects unresolved asset URL environment references", () => {
  writeFileSync("config.yml", 'assets:\n  baseUrl: "${MISSING_ASSET_URL}"\n');

  expect(() => loadConfigFromFile("config.yml")).toThrow("assets.baseUrl");
});

it.each(["file:///private/config", "https://user:private-test-token@example.com"])(
  "rejects unsupported or credential-bearing GitHub API endpoints: %s",
  (apiUrl) => {
    writeFileSync("config.yml", `github:\n  apiUrl: ${apiUrl}\n`);

    expect(() => loadConfigFromFile("config.yml")).toThrow(new Error(
      "Invalid Diffler config: github.apiUrl: Expected an HTTP(S) API URL without credentials, query, or fragment"
    ));
  }
);
