import { readFileSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function resolveEnv(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (value.startsWith("${") && value.endsWith("}")) {
    const envVar = value.slice(2, -1);
    return process.env[envVar] ?? value;
  }
  return value;
}

function deepResolveEnv(obj: unknown): unknown {
  if (typeof obj === "string") return resolveEnv(obj);
  if (Array.isArray(obj)) return obj.map(deepResolveEnv);
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = deepResolveEnv(v);
    }
    return result;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const GitHubProfileConfigSchema = z.object({
  username: z.string(),
  token: z.string().default("${GITHUB_TOKEN}"),
});

export type GitHubProfileConfig = z.infer<typeof GitHubProfileConfigSchema>;

export const GitHubConfigSchema = z.object({
  username: z.string().nullable().default(null),
  usernames: z.array(z.string()).default([]),
  token: z.string().default("${GITHUB_TOKEN}"),
  profiles: z.array(GitHubProfileConfigSchema).default([]),
  apiUrl: z.string().default("https://api.github.com"),
  graphqlUrl: z.string().default("https://api.github.com/graphql"),
  includeOrgs: z.boolean().default(false),
  largeRepoMode: z.boolean().default(false),
});

export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

export const TemplateConfigSchema = z.object({
  main: z.string().default("profile.md.j2"),
  directory: z.string().default(".github/diffler"),
  builtins: z.boolean().default(true),
});

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

export const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttl: z.number().int().default(3600),
  directory: z.string().nullable().default(null),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

export const StatsActionConfigSchema = z.object({
  outputPath: z.string().default(".diffler/stats.json"),
  cachePath: z.string().default(".diffler/cache-stable.json"),
  volatileCachePath: z.string().default(".diffler/cache-volatile.json"),
  maxRuntimeSeconds: z.number().int().default(480),
  graphqlConcurrency: z.number().int().default(2),
  restConcurrency: z.number().int().default(4),
  minGraphqlRemaining: z.number().int().default(500),
  minRestRemaining: z.number().int().default(750),
  includeTraffic: z.boolean().default(true),
  includeRestRepoStats: z.boolean().default(true),
  includePrivateRepositoryMetrics: z.boolean().default(false),
  includePrivateRepositoryDetails: z.boolean().default(false),
  includePrivateCacheDetails: z.boolean().default(false),
  backfillMode: z.enum(["resume", "refresh", "off"]).default("resume"),
  packageSources: z
    .array(
      z.object({
        provider: z.string().min(1),
        packages: z.array(z.string().min(1)),
      })
    )
    .default([]),
});

export type StatsActionConfig = z.infer<typeof StatsActionConfigSchema>;

export const DifflerConfigSchema = z.object({
  version: z.string().default("1"),
  github: GitHubConfigSchema.prefault({}),
  templates: TemplateConfigSchema.prefault({}),
  cache: CacheConfigSchema.prefault({}),
  statsAction: StatsActionConfigSchema.prefault({}),
  helpers: z.record(z.string(), z.unknown()).default({}),
  plugins: z.array(z.string()).default([]),
});

export type DifflerConfig = z.infer<typeof DifflerConfigSchema>;

// ---------------------------------------------------------------------------
// Config methods
// ---------------------------------------------------------------------------

export function getUsernames(github: GitHubConfig): string[] {
  if (github.usernames.length > 0) return github.usernames;
  if (github.username) return [github.username];
  return [];
}

export function getProfiles(github: GitHubConfig): GitHubProfileConfig[] {
  if (github.profiles.length > 0) return github.profiles;
  const usernames = getUsernames(github);
  if (usernames.length > 0) {
    return usernames.map((u) => ({ username: u, token: github.token }));
  }
  return [];
}

export function primaryProfileUsername(github: GitHubConfig): string {
  return getProfiles(github)[0]?.username ?? github.username ?? "unknown";
}

// Build StatsActionConfig with environment variable overrides (STATS_* prefix)
export function buildStatsActionConfig(config: DifflerConfig): StatsActionConfig {
  const base = { ...config.statsAction };

  function env(name: string, defaultValue: string): string {
    const envName = `STATS_${name.toUpperCase().replace(/-/g, "_")}`;
    return process.env[envName]?.trim() || defaultValue;
  }

  function envBool(name: string, defaultValue: boolean): boolean {
    const val = env(name, "");
    if (!val) return defaultValue;
    return ["1", "true", "yes", "on"].includes(val.toLowerCase());
  }

  function envNum(name: string, defaultValue: number): number {
    const val = env(name, "");
    if (!val) return defaultValue;
    const parsed = Number(val);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
  }

  base.outputPath = env("output-path", base.outputPath);
  base.cachePath = env("cache-path", base.cachePath);
  base.volatileCachePath = env("volatile-cache-path", base.volatileCachePath);
  base.maxRuntimeSeconds = envNum("max-runtime-seconds", base.maxRuntimeSeconds);
  base.graphqlConcurrency = envNum("graphql-concurrency", base.graphqlConcurrency);
  base.restConcurrency = envNum("rest-concurrency", base.restConcurrency);
  base.minGraphqlRemaining = envNum("min-graphql-remaining", base.minGraphqlRemaining);
  base.minRestRemaining = envNum("min-rest-remaining", base.minRestRemaining);
  base.includeTraffic = envBool("include-traffic", base.includeTraffic);
  base.includeRestRepoStats = envBool("include-rest-repo-stats", base.includeRestRepoStats);
  base.includePrivateRepositoryMetrics = envBool(
    "include-private-repository-metrics",
    base.includePrivateRepositoryMetrics
  );
  base.includePrivateRepositoryDetails = envBool(
    "include-private-repository-details",
    base.includePrivateRepositoryDetails
  );
  base.includePrivateCacheDetails = envBool(
    "include-private-cache-details",
    base.includePrivateCacheDetails
  );
  const backfillMode = env("backfill-mode", base.backfillMode);
  if (backfillMode === "resume" || backfillMode === "refresh" || backfillMode === "off") {
    base.backfillMode = backfillMode;
  }
  const npmPackages = env("npm-packages", "")
    .split(",")
    .map((packageName) => packageName.trim())
    .filter(Boolean);
  if (npmPackages.length > 0) {
    const configuredSources = base.packageSources.filter(
      (source) => source.provider !== "npm"
    );
    base.packageSources = [
      ...configuredSources,
      { provider: "npm", packages: npmPackages },
    ];
  }

  return base;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG_PATH = ".github/diffler.yml";

export function loadConfigFromFile(path: string = DEFAULT_CONFIG_PATH): DifflerConfig {
  loadDotenv();
  const raw = readFileSync(path, "utf-8");
  const parsed = parseYaml(raw);
  const resolved = deepResolveEnv(parsed);
  return DifflerConfigSchema.parse(resolved);
}

export function loadConfigFromEnv(): DifflerConfig {
  loadDotenv();
  const config: DifflerConfig = DifflerConfigSchema.parse({});

  const envUsername = process.env.DIFFLER_GITHUB_USERNAME;
  const envToken = process.env.GITHUB_TOKEN;
  const envMain = process.env.DIFFLER_TEMPLATE_MAIN;

  if (envUsername) {
    config.github.username = envUsername;
  }
  if (envToken) {
    config.github.token = envToken;
  }
  if (envMain) {
    config.templates.main = envMain;
  }

  return config;
}

export function loadConfig(path?: string): DifflerConfig {
  if (path) {
    return loadConfigFromFile(path);
  }
  try {
    return loadConfigFromFile(DEFAULT_CONFIG_PATH);
  } catch {
    return loadConfigFromEnv();
  }
}
