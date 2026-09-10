import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { GitHubStatsOutput, RepositoryRecord, UserProfile } from "@lukasparke/diffler-schemas";
import type { DifflerConfig, GitHubProfileConfig } from "../config.js";
import { GitHubClient } from "../github/client.js";
import { runStatsCollection } from "../stats/index.js";
import type { CollectionPlan } from "./plan.js";
import { buildProfileStatsConfig, profileExtrasDirectory } from "./paths.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function readExtrasCache(
  path: string,
  config: DifflerConfig["cache"]
): Record<string, unknown>[] | undefined {
  if (!config.enabled || config.ttl <= 0) return undefined;
  try {
    const cached: unknown = JSON.parse(readFileSync(path, "utf-8"));
    if (!isRecord(cached) || typeof cached.fetchedAt !== "number") return undefined;
    const age = Date.now() - cached.fetchedAt;
    if (age < 0 || age >= config.ttl * 1000 || !isRecordArray(cached.data)) {
      return undefined;
    }
    return cached.data;
  } catch {
    return undefined;
  }
}

async function fetchExtra(
  client: GitHubClient,
  username: string,
  resource: "orgs" | "gists",
  cachePath: string,
  cacheConfig: DifflerConfig["cache"]
): Promise<Record<string, unknown>[]> {
  const cached = readExtrasCache(cachePath, cacheConfig);
  if (cached) return cached;

  const records: Record<string, unknown>[] = [];
  for (let page = 1; ; page++) {
    const data = await client.restGet(`/users/${encodeURIComponent(username)}/${resource}`, {
      per_page: 100,
      page,
    });
    if (!isRecordArray(data)) {
      throw new Error(`Invalid ${resource} response for ${username}: expected an array of objects`);
    }
    records.push(...data);
    if (data.length < 100) break;
    if (page === 10) {
      throw new Error(`Incomplete ${resource} collection for ${username}: pagination limit exceeded`);
    }
  }

  const result = records.map((record) =>
    resource === "orgs"
      ? {
          login: record.login ?? "",
          id: record.id ?? null,
          url: record.url ?? "",
          avatar_url: record.avatar_url ?? "",
          description: record.description ?? null,
        }
      : {
          id: record.id ?? "",
          description: record.description ?? null,
          html_url: record.html_url ?? "",
          public: record.public ?? true,
          created_at: record.created_at ?? null,
          updated_at: record.updated_at ?? null,
          files: isRecord(record.files) ? Object.keys(record.files) : [],
        }
  );

  if (cacheConfig.enabled && cacheConfig.ttl > 0) {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ fetchedAt: Date.now(), data: result }, null, 2));
  }
  return result;
}

export interface CollectionExtras {
  profiles?: UserProfile[];
  organizations?: Record<string, unknown>[];
  gists?: Record<string, unknown>[];
  pinnedRepositories?: RepositoryRecord[];
}

export class UnifiedEngine {
  async collect(
    plan: CollectionPlan,
    config: DifflerConfig,
    profile: GitHubProfileConfig
  ): Promise<{ output: GitHubStatsOutput; extras: CollectionExtras }> {
    const statsConfig = buildProfileStatsConfig(plan, config, profile);
    const client = new GitHubClient({
      ...config.github,
      username: profile.username,
      token: profile.token,
    });

    const output = await runStatsCollection(statsConfig, client);
    if (output.profile.login.toLowerCase() !== profile.username.trim().toLowerCase()) {
      throw new Error(
        `Collected GitHub account ${output.profile.login} does not match requested profile ${profile.username}`
      );
    }
    const extras: CollectionExtras = { profiles: [output.profile] };
    const extrasDirectory = profileExtrasDirectory(config, profile);

    if (plan.needsOrganizations) {
      extras.organizations = await fetchExtra(
        client, profile.username, "orgs", resolve(extrasDirectory, "orgs.json"), config.cache
      );
    }
    if (plan.needsGists) {
      extras.gists = await fetchExtra(
        client, profile.username, "gists", resolve(extrasDirectory, "gists.json"), config.cache
      );
    }

    return { output, extras };
  }
}
