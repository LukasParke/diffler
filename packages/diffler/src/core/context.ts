import type { DifflerConfig } from "../config.js";
import { getProfiles } from "../config.js";
import { GitHubClient } from "../github/client.js";
import { prefetchSources, type SourceStore } from "../helpers/prefetch.js";
import {
  analyzeTemplate,
  collectProfiles,
  deriveContext,
  publicConfig,
  buildStubContext,
} from "../engine/index.js";

export class ContextBuilder {
  constructor(readonly config: DifflerConfig) {}

  async build(templateSource: string, sources?: SourceStore): Promise<Record<string, unknown>> {
    const profiles = getProfiles(this.config.github);
    if (sources) {
      await prefetchSources(templateSource, profiles.map((profile) => ({
        username: profile.username,
        client: new GitHubClient({ ...this.config.github, ...profile }),
      })), profiles[0]?.username ?? "unknown", sources);
    }
    const plan = analyzeTemplate(templateSource);
    if (!Object.values(plan).some(Boolean)) {
      return { config: publicConfig(this.config), multi_profile: getProfiles(this.config.github).length > 1 };
    }

    if (!profiles.length) {
      console.warn("No GitHub usernames configured; using uncollected placeholder data.");
      return buildStubContext(this.config);
    }

    const { output, extras } = await collectProfiles(plan, this.config);
    return deriveContext(output, this.config, extras, profiles.length > 1);
  }
}
