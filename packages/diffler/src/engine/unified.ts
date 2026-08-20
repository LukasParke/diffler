import { resolve } from "node:path";
import type { GitHubStatsOutput } from "@lukasparke/diffler-schemas";
import type { DifflerConfig, GitHubProfileConfig } from "../config.js";
import { buildStatsActionConfig } from "../config.js";
import { GitHubClient } from "../github/client.js";
import { runStatsCollection } from "../stats/index.js";
import type { CollectionPlan } from "./plan.js";

const DIFFLER_DIR = ".diffler";

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

  // Only collect the expensive optional REST metrics the template consumes.
  // Configuration can still turn them off, but the template decides the default.
  statsConfig.includeTraffic = statsConfig.includeTraffic && plan.needsTraffic;
  statsConfig.includeRestRepoStats =
    statsConfig.includeRestRepoStats && plan.needsContributorStats;

  return statsConfig;
}

export class UnifiedEngine {
  async collect(
    plan: CollectionPlan,
    config: DifflerConfig,
    profile: GitHubProfileConfig
  ): Promise<GitHubStatsOutput> {
    const statsConfig = buildStatsConfig(config, plan);
    const client = new GitHubClient({
      ...config.github,
      username: profile.username,
      token: profile.token,
    });

    return runStatsCollection(statsConfig, client);
  }
}
