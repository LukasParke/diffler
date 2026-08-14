import type { DifflerConfig, GitHubProfileConfig } from "../config.js";
import { getProfiles } from "../config.js";
import {
  analyzeTemplate,
  UnifiedEngine,
  deriveContext,
  buildStubContext,
  type CollectionExtras,
} from "../engine/index.js";
import type { GitHubStatsOutput } from "@lukasparke/diffler-schemas";

function mergeOutputs(
  outputs: GitHubStatsOutput[],
  extrasList: CollectionExtras[]
): { output: GitHubStatsOutput; extras: CollectionExtras } {
  if (outputs.length === 1) {
    return { output: outputs[0], extras: extrasList[0] };
  }

  const [first, ...rest] = outputs;
  const mergedExtras: CollectionExtras = {
    organizations: [...(extrasList[0].organizations ?? [])],
    gists: [...(extrasList[0].gists ?? [])],
  };

  for (let i = 1; i < rest.length; i++) {
    const next = rest[i];
    const extra = extrasList[i];

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

    // Merge extras
    if (extra.organizations) {
      mergedExtras.organizations!.push(...extra.organizations);
    }
    if (extra.gists) {
      mergedExtras.gists!.push(...extra.gists);
    }
  }

  return { output: first, extras: mergedExtras };
}

export class ContextBuilder {
  private config: DifflerConfig;

  constructor(config: DifflerConfig) {
    this.config = config;
  }

  async build(templateSource: string): Promise<Record<string, unknown>> {
    const profiles = getProfiles(this.config.github);
    if (!profiles.length) {
      console.warn("No GitHub usernames configured; using stub data.");
      return buildStubContext(this.config) as unknown as Record<string, unknown>;
    }

    const plan = analyzeTemplate(templateSource);
    const engine = new UnifiedEngine();

    if (profiles.length === 1) {
      const { output, extras } = await engine.collect(plan, this.config, profiles[0]);
      return deriveContext(output, this.config, extras, false) as unknown as Record<string, unknown>;
    }

    return this.buildMultiUser(plan, engine, profiles);
  }

  private async buildMultiUser(
    plan: ReturnType<typeof analyzeTemplate>,
    engine: UnifiedEngine,
    profiles: GitHubProfileConfig[]
  ): Promise<Record<string, unknown>> {
    const outputs: GitHubStatsOutput[] = [];
    const extrasList: CollectionExtras[] = [];

    for (const profile of profiles) {
      console.info("Collecting data for %s", profile.username);
      try {
        const { output, extras } = await engine.collect(plan, this.config, profile);
        outputs.push(output);
        extrasList.push(extras);
      } catch (err) {
        console.error("Failed to collect data for %s:", profile.username, err);
      }
    }

    if (outputs.length === 0) {
      return buildStubContext(this.config) as unknown as Record<string, unknown>;
    }

    const { output, extras } = mergeOutputs(outputs, extrasList);
    return deriveContext(output, this.config, extras, true) as unknown as Record<string, unknown>;
  }
}
