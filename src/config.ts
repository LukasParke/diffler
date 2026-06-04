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

export const DifflerConfigSchema = z.object({
  version: z.string().default("1"),
  github: GitHubConfigSchema.default({}),
  templates: TemplateConfigSchema.default({}),
  cache: CacheConfigSchema.default({}),
  helpers: z.record(z.unknown()).default({}),
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
