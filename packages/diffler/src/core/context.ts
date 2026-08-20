import type { DifflerConfig, GitHubProfileConfig } from "../config.js";
import { getProfiles } from "../config.js";
import { GitHubClient } from "../github/client.js";
import { prefetchSources, type SourceStore } from "../helpers/prefetch.js";
import {
  analyzeTemplate,
  UnifiedEngine,
  deriveContext,
  buildStubContext,
} from "../engine/index.js";
import type { GitHubStatsOutput } from "@lukasparke/diffler-schemas";

function mergeOutputs(outputs: GitHubStatsOutput[]): GitHubStatsOutput {
  if (outputs.length === 1) {
    return outputs[0];
  }

  const [first, ...rest] = outputs;

  for (const next of rest) {
    // Merge contribution counts
    first.profileContributions.totalContributions +=
      next.profileContributions.totalContributions;
    first.profileContributions.totalCommitContributions +=
      next.profileContributions.totalCommitContributions;
    first.profileContributions.totalIssueContributions +=
      next.profileContributions.totalIssueContributions;
    first.profileContributions.totalPullRequestContributions +=
      next.profileContributions.totalPullRequestContributions;
    first.profileContributions.totalPullRequestReviewContributions +=
      next.profileContributions.totalPullRequestReviewContributions;

    // Merge activity
    first.activity.totalPullRequests += next.activity.totalPullRequests;
    first.activity.openIssues += next.activity.openIssues;
    first.activity.closedIssues += next.activity.closedIssues;
    first.activity.repositoriesContributedTo +=
      next.activity.repositoriesContributedTo;
    first.activity.discussionsStarted += next.activity.discussionsStarted;
    first.activity.discussionsAnswered += next.activity.discussionsAnswered;
    first.activity.starsGiven += next.activity.starsGiven;

    // Merge repositories (dedup by id)
    const existingIds = new Set(first.repositories.map((r) => r.id));
    for (const repo of next.repositories) {
      if (!existingIds.has(repo.id)) {
        first.repositories.push(repo);
        existingIds.add(repo.id);
      }
    }
  }

  return first;
}

export class ContextBuilder {
  config: DifflerConfig;

  constructor(config: DifflerConfig) {
    this.config = config;
  }

  async build(
    templateSource: string,
    sources?: SourceStore
  ): Promise<Record<string, unknown>> {
    const profiles = getProfiles(this.config.github);
    if (!profiles.length) {
      console.warn("No GitHub usernames configured; using stub data.");
      return buildStubContext(this.config) as unknown as Record<string, unknown>;
    }

    if (sources) {
      const clients = profiles.map(
        (profile) =>
          new GitHubClient({
            ...this.config.github,
            username: profile.username,
            token: profile.token,
          })
      );
      await prefetchSources(
        templateSource,
        clients.map((client, index) => ({ username: profiles[index].username, client })),
        profiles[0].username,
        sources
      );
    }

    const plan = analyzeTemplate(templateSource);
    const engine = new UnifiedEngine();

    if (profiles.length === 1) {
      const output = await engine.collect(plan, this.config, profiles[0]);
      return deriveContext(output, this.config, false) as unknown as Record<string, unknown>;
    }

    return this.buildMultiUser(plan, engine, profiles);
  }

  private async buildMultiUser(
    plan: ReturnType<typeof analyzeTemplate>,
    engine: UnifiedEngine,
    profiles: GitHubProfileConfig[]
  ): Promise<Record<string, unknown>> {
    const outputs: GitHubStatsOutput[] = [];

    for (const profile of profiles) {
      console.info("Collecting data for %s", profile.username);
      try {
        const output = await engine.collect(plan, this.config, profile);
        outputs.push(output);
      } catch (err) {
        console.error("Failed to collect data for %s:", profile.username, err);
      }
    }

    if (outputs.length === 0) {
      return buildStubContext(this.config) as unknown as Record<string, unknown>;
    }

    const output = mergeOutputs(outputs);
    return deriveContext(output, this.config, true) as unknown as Record<string, unknown>;
  }
}
