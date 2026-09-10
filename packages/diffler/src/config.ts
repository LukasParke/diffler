import { readFileSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { githubUsernameSchema } from "@lukasparke/diffler-schemas";

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

const NonEmptyStringSchema = z.string().trim().min(1);
const PathSchema = z.string().refine(
  (value) => value.trim().length > 0 && !value.includes("\0"),
  "Expected a non-empty path without null bytes"
);
const UsernameSchema = NonEmptyStringSchema.pipe(githubUsernameSchema);
const TokenSchema = z.preprocess(resolveEnv, NonEmptyStringSchema);
const ApiUrlSchema = NonEmptyStringSchema.url().regex(
  /^https?:\/\/[^@?#\s]+$/i,
  "Expected an HTTP(S) API URL without credentials, query, or fragment"
);

export const GitHubProfileConfigSchema = z.object({
  username: UsernameSchema,
  token: TokenSchema.default("${GITHUB_TOKEN}"),
});

export type GitHubProfileConfig = z.infer<typeof GitHubProfileConfigSchema>;

export const GitHubConfigSchema = z.object({
  username: UsernameSchema.nullable().default(null),
  usernames: z.array(UsernameSchema).default([]),
  token: TokenSchema.default("${GITHUB_TOKEN}"),
  profiles: z.array(GitHubProfileConfigSchema.extend({ token: TokenSchema.optional() })).default([]),
  apiUrl: ApiUrlSchema.default("https://api.github.com"),
  graphqlUrl: ApiUrlSchema.default("https://api.github.com/graphql"),
  includeOrgs: z.boolean().default(false),
  largeRepoMode: z.boolean().default(false),
}).transform((github) => ({
  ...github,
  profiles: github.profiles.map((profile) => ({
    ...profile,
    token: profile.token ?? github.token,
  })),
}));

export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

export const TemplateConfigSchema = z.object({
  main: PathSchema.default("profile.md.j2"),
  directory: PathSchema.default(".github/diffler"),
  builtins: z.boolean().default(true),
});

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

export const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttl: z.number().int().nonnegative().default(3600),
  directory: PathSchema.nullable().default(null),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

export const StatsActionConfigSchema = z.object({
  outputPath: PathSchema.default(".diffler/stats.json"),
  cachePath: PathSchema.default(".diffler/cache-stable.json"),
  volatileCachePath: PathSchema.default(".diffler/cache-volatile.json"),
  maxRuntimeSeconds: z.number().int().positive().default(480),
  graphqlConcurrency: z.number().int().positive().default(2),
  restConcurrency: z.number().int().positive().default(4),
  minGraphqlRemaining: z.number().int().nonnegative().default(500),
  minRestRemaining: z.number().int().nonnegative().default(750),
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

export const ProfileAssetsConfigSchema = z.object({
  baseUrl: NonEmptyStringSchema.refine((value) => {
    if (/[\s<>"'?#\\]/.test(value) || value.includes("${") || value.startsWith("//")) return false;
    if (!/^[a-z][a-z\d+.-]*:/i.test(value)) return true;
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Expected an HTTP(S) URL or a relative asset directory, without credentials, query, or fragment")
    .default("./assets"),
  format: z.enum(["webp", "gif"]).default("webp"),
});

export type ProfileAssetsConfig = z.infer<typeof ProfileAssetsConfigSchema>;

export const DifflerConfigSchema = z.object({
  version: z.string().default("1"),
  github: GitHubConfigSchema.prefault({}),
  templates: TemplateConfigSchema.prefault({}),
  cache: CacheConfigSchema.prefault({}),
  statsAction: StatsActionConfigSchema.prefault({}),
  assets: ProfileAssetsConfigSchema.optional(),
  helpers: z.record(z.string(), z.unknown()).default({}),
  plugins: z.array(z.string()).default([]),
});

const statsActionOverrides = Symbol("statsActionOverrides");

export type DifflerConfig = z.infer<typeof DifflerConfigSchema> & {
  [statsActionOverrides]?: Partial<StatsActionConfig>;
};

function parseConfig<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  // Full validation errors and YAML source excerpts can contain credentials.
  const fields = result.error.issues.map((issue) => {
    const path = issue.path.join(".") || "configuration";
    const message = issue.code === "invalid_value"
      ? `expected one of ${issue.values.join(", ")}`
      : issue.code === "invalid_type"
        ? `expected ${issue.expected}`
        : issue.message;
    return `${path}: ${message}`;
  });
  throw new Error(`Invalid Diffler config: ${fields.join("; ")}`);
}

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
    if (["1", "true", "yes", "on"].includes(val.toLowerCase())) return true;
    if (["0", "false", "no", "off"].includes(val.toLowerCase())) return false;
    throw new Error(`Invalid STATS_${name.toUpperCase().replace(/-/g, "_")}: expected a boolean`);
  }

  function envNum(name: string, defaultValue: number): number {
    const val = env(name, "");
    if (!val) return defaultValue;
    return Number(val);
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

  return parseConfig(StatsActionConfigSchema, { ...base, backfillMode, ...config[statsActionOverrides] });
}

/** Preserve explicit command options when downstream collectors reapply STATS_* settings. */
export function withStatsActionOverrides(
  config: DifflerConfig,
  overrides: Partial<StatsActionConfig>
): DifflerConfig {
  const combined = { ...config[statsActionOverrides], ...overrides };
  return {
    ...config,
    statsAction: parseConfig(StatsActionConfigSchema, { ...buildStatsActionConfig(config), ...combined }),
    [statsActionOverrides]: combined,
  };
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG_PATH = ".github/diffler.yml";

export function loadConfigFromFile(path: string = DEFAULT_CONFIG_PATH): DifflerConfig {
  loadDotenv({ quiet: true });
  const raw = readFileSync(path, "utf-8");
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch {
    throw new Error(`Invalid YAML in Diffler config file: ${path}`);
  }
  const resolved = deepResolveEnv(parsed);
  const config = parseConfig(DifflerConfigSchema, resolved);
  return parseConfig(DifflerConfigSchema, {
    ...config,
    github: getProfiles(config.github).length > 0 ? config.github : {
      ...config.github,
      username: process.env.DIFFLER_GITHUB_USERNAME || process.env.GITHUB_REPOSITORY_OWNER || null,
    },
    assets: config.assets ?? (process.env.DIFFLER_ASSET_BASE_URL
      ? { baseUrl: process.env.DIFFLER_ASSET_BASE_URL }
      : undefined),
  });
}

export function loadConfigFromEnv(): DifflerConfig {
  loadDotenv({ quiet: true });
  return parseConfig(DifflerConfigSchema, {
    github: {
      username: process.env.DIFFLER_GITHUB_USERNAME || process.env.GITHUB_REPOSITORY_OWNER || null,
      token: process.env.GITHUB_TOKEN || undefined,
    },
    templates: {
      main: process.env.DIFFLER_TEMPLATE_MAIN || undefined,
      directory: process.env.DIFFLER_TEMPLATE_DIRECTORY || undefined,
    },
    assets: process.env.DIFFLER_ASSET_BASE_URL
      ? { baseUrl: process.env.DIFFLER_ASSET_BASE_URL }
      : undefined,
  });
}

export function loadConfig(path?: string): DifflerConfig {
  if (path !== undefined) {
    if (!path.trim()) throw new Error("Config file path must not be empty");
    return loadConfigFromFile(path);
  }
  try {
    return loadConfigFromFile(DEFAULT_CONFIG_PATH);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return loadConfigFromEnv();
    }
    throw error;
  }
}
