import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { GitHubStatsOutput } from "@diffler/schemas";
import type { DifflerConfig, GitHubProfileConfig } from "../config.js";
import { buildStatsActionConfig } from "../config.js";
import { GitHubClient } from "../github/client.js";
import { runStatsCollection } from "../stats/index.js";
import type { CollectionPlan } from "./plan.js";

const DIFFLER_DIR = ".diffler";

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readJsonCache<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

function writeJsonCache(path: string, data: unknown): void {
  ensureDir(path);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

function buildStatsConfig(config: DifflerConfig, plan: CollectionPlan) {
  const statsConfig = buildStatsActionConfig(config);

  // Migrate old cache paths to .diffler/
  if (statsConfig.cachePath.includes(".github-profile-stats")) {
    statsConfig.cachePath = resolve(DIFFLER_DIR, "cache-stable.json");
  }
  if (statsConfig.volatileCachePath.includes(".github-profile-stats")) {
    statsConfig.volatileCachePath = resolve(DIFFLER_DIR, "cache-volatile.json");
  }
  if (statsConfig.outputPath === "github-user-stats.json") {
    statsConfig.outputPath = resolve(DIFFLER_DIR, "stats.json");
  }

  // Disable backfill if nothing in the plan needs it
  if (!plan.needsTraffic && !plan.needsContributorStats) {
    statsConfig.backfillMode = "off";
  }

  return statsConfig;
}

async function fetchOrganizations(
  client: GitHubClient,
  username: string
): Promise<Record<string, unknown>[]> {
  const cachePath = resolve(DIFFLER_DIR, `orgs-${username}.json`);
  const cached = readJsonCache<Record<string, unknown>[]>(cachePath);
  if (cached) return cached;

  const orgs: Record<string, unknown>[] = [];
  let page = 1;

  while (true) {
    const data = (await client.restGet(`/users/${username}/orgs`, {
      per_page: 100,
      page,
    })) as Record<string, unknown>[];

    if (!Array.isArray(data) || data.length === 0) break;

    for (const org of data) {
      orgs.push({
        login: org.login ?? "",
        id: org.id ?? null,
        url: org.url ?? "",
        avatar_url: org.avatar_url ?? "",
        description: org.description ?? null,
      });
    }

    if (data.length < 100) break;
    page++;
    if (page > 10) break;
  }

  writeJsonCache(cachePath, orgs);
  return orgs;
}

async function fetchGists(
  client: GitHubClient,
  username: string
): Promise<Record<string, unknown>[]> {
  const cachePath = resolve(DIFFLER_DIR, `gists-${username}.json`);
  const cached = readJsonCache<Record<string, unknown>[]>(cachePath);
  if (cached) return cached;

  const allGists: Record<string, unknown>[] = [];
  let page = 1;

  while (true) {
    const data = (await client.restGet(`/users/${username}/gists`, {
      per_page: 100,
      page,
    })) as Record<string, unknown>[];

    if (!Array.isArray(data) || data.length === 0) break;

    for (const gist of data) {
      allGists.push({
        id: gist.id ?? "",
        description: gist.description ?? null,
        html_url: gist.html_url ?? "",
        public: gist.public ?? true,
        created_at: gist.created_at ?? null,
        updated_at: gist.updated_at ?? null,
        files: Object.keys((gist.files as Record<string, unknown>) ?? {}),
      });
    }

    if (data.length < 100) break;
    page++;
    if (page > 10) break;
  }

  writeJsonCache(cachePath, allGists);
  return allGists;
}

export interface CollectionExtras {
  organizations?: Record<string, unknown>[];
  gists?: Record<string, unknown>[];
}

export class UnifiedEngine {
  async collect(
    plan: CollectionPlan,
    config: DifflerConfig,
    profile: GitHubProfileConfig
  ): Promise<{ output: GitHubStatsOutput; extras: CollectionExtras }> {
    const statsConfig = buildStatsConfig(config, plan);
    const client = new GitHubClient({
      ...config.github,
      username: profile.username,
      token: profile.token,
    });

    const output = await runStatsCollection(statsConfig, client);
    const extras: CollectionExtras = {};

    if (plan.needsOrganizations) {
      extras.organizations = await fetchOrganizations(client, profile.username);
    }

    if (plan.needsGists) {
      extras.gists = await fetchGists(client, profile.username);
    }

    return { output, extras };
  }
}
