import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { DifflerConfig, GitHubProfileConfig } from "../config.js";
import { getProfiles } from "../config.js";
import { CollectorContext } from "../collectors/context.js";
import { CollectorRegistry } from "../collectors/registry.js";
import { StatsCache } from "../collectors/cache.js";
import { aggregateResults } from "../collectors/aggregate.js";
import { buildV2Output } from "../collectors/v2Output.js";

// Import all collectors
import { profileCollector } from "../collectors/profile.js";
import { contributionsCollector } from "../collectors/contributions.js";
import { multiYearContributionsCollector } from "../collectors/multiYearContributions.js";
import { repositoriesCollector } from "../collectors/repositories.js";
import { organizationsCollector } from "../collectors/organizations.js";
import { trafficCollector } from "../collectors/traffic.js";
import { contributorStatsCollector } from "../collectors/contributorStats.js";
import { gistsCollector } from "../collectors/gists.js";
import { activityCollector } from "../collectors/activity.js";
import { discussionsCollector } from "../collectors/discussions.js";
import { starsGivenCollector } from "../collectors/starsGiven.js";
import { repoContributionsCollector } from "../collectors/repoContributions.js";
import { repoStatsCollector } from "../collectors/repoStats.js";
import { computedStatsCollector } from "../collectors/computedStats.js";

function createRegistry(): CollectorRegistry {
  const registry = new CollectorRegistry();
  registry.register(profileCollector);
  registry.register(contributionsCollector);
  registry.register(multiYearContributionsCollector);
  registry.register(organizationsCollector);
  registry.register(repositoriesCollector);
  registry.register(trafficCollector);
  registry.register(contributorStatsCollector);
  registry.register(gistsCollector);
  registry.register(activityCollector);
  registry.register(discussionsCollector);
  registry.register(starsGivenCollector);
  registry.register(repoContributionsCollector);
  registry.register(repoStatsCollector);
  registry.register(computedStatsCollector);
  return registry;
}

function initCache(config: DifflerConfig): StatsCache {
  if (!config.cache.enabled) {
    return new StatsCache();
  }
  if (config.cache.directory) {
    const dir = resolve(config.cache.directory);
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
    return new StatsCache(resolve(dir, "cache.json"));
  }
  return new StatsCache(".github-profile-stats/cache.json");
}

export class ContextBuilder {
  private config: DifflerConfig;
  private registry: CollectorRegistry;
  private cache: StatsCache;

  constructor(config: DifflerConfig) {
    this.config = config;
    this.registry = createRegistry();
    this.cache = initCache(config);
  }

  async build(templateSource: string): Promise<Record<string, unknown>> {
    const profiles = getProfiles(this.config.github);
    if (!profiles.length) {
      console.warn("No GitHub usernames configured; using stub data.");
      return this.buildStubContext();
    }

    if (profiles.length === 1) {
      return this.buildSingleUser(templateSource, profiles[0]);
    }

    return this.buildMultiUser(templateSource, profiles);
  }

  private async buildSingleUser(
    templateSource: string,
    profile: GitHubProfileConfig
  ): Promise<Record<string, unknown>> {
    const originalUsername = this.config.github.username;
    const originalToken = this.config.github.token;

    try {
      this.config.github.username = profile.username;
      this.config.github.token = profile.token;

      const ctx = new CollectorContext(this.config, this.cache);
      const needed = this.registry.discoverNeeded(templateSource);
      await this.runCollectors(needed, ctx);

      if (this.config.cache.enabled) {
        this.cache.save();
      }

      return this.buildContextFromResults(ctx.results);
    } finally {
      this.config.github.username = originalUsername;
      this.config.github.token = originalToken;
    }
  }

  private async buildMultiUser(
    templateSource: string,
    profiles: GitHubProfileConfig[]
  ): Promise<Record<string, unknown>> {
    const resultsByUser: Record<string, Record<string, unknown>> = {};
    const originalUsername = this.config.github.username;
    const originalToken = this.config.github.token;

    try {
      for (const profile of profiles) {
        console.info("Collecting data for %s", profile.username);
        this.config.github.username = profile.username;
        this.config.github.token = profile.token;

        try {
          const ctx = new CollectorContext(this.config, this.cache);
          const needed = this.registry.discoverNeeded(templateSource);
          await this.runCollectors(needed, ctx);
          resultsByUser[profile.username] = { ...ctx.results };
        } catch (err) {
          console.error("Failed to collect data for %s:", profile.username, err);
          resultsByUser[profile.username] = {};
        }
      }
    } finally {
      this.config.github.username = originalUsername;
      this.config.github.token = originalToken;
    }

    if (this.config.cache.enabled) {
      this.cache.save();
    }

    const aggregated = aggregateResults(resultsByUser);
    return this.buildContextFromResults(aggregated, true);
  }

  private async runCollectors(needed: string[], ctx: CollectorContext): Promise<void> {
    if (!needed.length) return;

    const statuses = await this.registry.run(needed, ctx);
    const collectionStatus: Record<string, unknown> = {
      complete: true,
      coreComplete: true,
      backfillPending: 0,
      backfillCompletedThisRun: 0,
      backfillFailedThisRun: 0,
      warnings: [],
      errors: [],
      timestamp: new Date().toISOString(),
    };

    const success = Object.values(statuses).filter((s) => s === "success").length;
    const failed = Object.values(statuses).filter((s) => s === "failed").length;
    const skipped = Object.values(statuses).filter((s) => s === "skipped").length;

    collectionStatus.backfillCompletedThisRun = success;
    collectionStatus.backfillFailedThisRun = failed;
    collectionStatus.backfillPending = skipped;

    for (const [name, status] of Object.entries(statuses)) {
      if (status === "failed") {
        (collectionStatus.errors as string[]).push(`Collector ${name} failed`);
      } else if (status === "skipped") {
        (collectionStatus.warnings as string[]).push(`Collector ${name} skipped (rate limit)`);
      }
    }

    collectionStatus.complete = failed === 0;
    collectionStatus.coreComplete = ["profile", "contributions"].every(
      (n) => !statuses[n] || statuses[n] === "success"
    );

    ctx.results._collection_status = collectionStatus;
  }

  private buildContextFromResults(
    results: Record<string, unknown>,
    multiProfile = false
  ): Record<string, unknown> {
    const stats = buildV2Output(results);
    const profile = (results.profile as Record<string, unknown>) ?? {};
    const contributions = (results.contributions as Record<string, unknown>) ?? {};
    const repos = (results.repositories as Record<string, unknown>[]) ?? [];
    const profiles = (results.profiles as Record<string, unknown>[]) ?? [];

    return {
      config: this.config,
      github: {
        user: {
          login: profile.login || this.config.github.username || "unknown",
          name: profile.name || this.config.github.username || "unknown",
          bio: profile.bio ?? null,
          company: profile.company ?? null,
          location: profile.location ?? null,
          website_url: profile.websiteUrl ?? null,
          twitter_username: profile.twitterUsername ?? null,
          email: profile.email ?? null,
          created_at: profile.createdAt ?? null,
          followers: profile.followers ?? 0,
          following: profile.following ?? 0,
          starred_repositories: profile.starredRepositories ?? 0,
          repositories: repos,
          pinned_repositories: [],
          contributions: {
            total: contributions.totalContributions ?? 0,
            commits: contributions.totalCommitContributions ?? 0,
            issues: contributions.totalIssueContributions ?? 0,
            pull_requests: contributions.totalPullRequestContributions ?? 0,
            reviews: contributions.totalPullRequestReviewContributions ?? 0,
            calendar: contributions.calendar ?? [],
          },
        },
      },
      stats,
      profile,
      profiles,
      contributions,
      repositories: repos,
      gists: results.gists ?? [],
      traffic: results.traffic ?? {},
      contributor_stats: results.contributor_stats ?? [],
      activity: results.activity ?? {},
      discussions: results.discussions ?? {},
      stars_given: results.stars_given ?? [],
      repo_contributions: results.repo_contributions ?? {},
      repo_stats: results.repo_stats ?? {},
      computed_stats: results.computed_stats ?? {},
      collection_status: results._collection_status ?? {},
      multi_profile: multiProfile,
    };
  }

  private buildStubContext(): Record<string, unknown> {
    const username = this.config.github.username || "unknown";
    return {
      config: this.config,
      github: {
        user: {
          login: username,
          name: username,
          bio: null,
          company: null,
          location: null,
          website_url: null,
          twitter_username: null,
          followers: 0,
          following: 0,
          starred_repositories: 0,
          repositories: [],
          pinned_repositories: [],
          contributions: {
            total: 0,
            commits: 0,
            issues: 0,
            pull_requests: 0,
            reviews: 0,
            calendar: [],
          },
        },
      },
      stats: {},
      profiles: [],
      multi_profile: false,
    };
  }
}
