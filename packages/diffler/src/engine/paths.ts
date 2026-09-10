import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import type { DifflerConfig, GitHubProfileConfig } from "../config.js";
import { buildStatsActionConfig } from "../config.js";
import type { StatsActionConfig } from "../stats/types.js";
import type { CollectionPlan } from "./plan.js";

export function accountNamespace(
  config: DifflerConfig,
  profile: GitHubProfileConfig
): string {
  const username = encodeURIComponent(profile.username.trim().toLowerCase());
  const endpoints = [config.github.apiUrl, config.github.graphqlUrl]
    .map((endpoint) => new URL(endpoint).href.replace(/\/+$/, ""));
  const hostKey = createHash("sha256").update(JSON.stringify(endpoints)).digest("hex").slice(0, 12);
  return `${username}-${hostKey}`;
}

export function profileExtrasDirectory(config: DifflerConfig, profile: GitHubProfileConfig): string {
  return resolve(config.cache.directory ?? ".diffler", "extras", accountNamespace(config, profile));
}

export function buildProfileStatsConfig(
  plan: CollectionPlan,
  config: DifflerConfig,
  profile: GitHubProfileConfig
): StatsActionConfig {
  const base = buildStatsActionConfig(config);
  const namespace = accountNamespace(config, profile);
  const scopedPath = (path: string): string =>
    resolve(dirname(path), "profiles", namespace, basename(path));
  const includeTraffic = base.includeTraffic && plan.needsTraffic;
  const includeRestRepoStats = base.includeRestRepoStats && plan.needsContributorStats;

  return {
    ...base,
    cachePath: scopedPath(base.cachePath),
    volatileCachePath: scopedPath(base.volatileCachePath),
    outputPath: scopedPath(base.outputPath),
    includeTraffic,
    includeRestRepoStats,
    backfillMode: includeTraffic || includeRestRepoStats ? base.backfillMode : "off",
  };
}
