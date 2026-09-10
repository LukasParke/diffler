import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { githubStatsOutputSchema } from "@lukasparke/diffler-schemas";
import { buildStubContext, deriveContext } from "../../src/engine/index.js";
import { createConfig, createOutput, createRepository, NOW } from "./fixtures.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

it("preserves the typed activity and starred count", () => {
  const output = createOutput();

  const context = deriveContext(output, createConfig());

  expect(context.activity).toBe(output.activity);
  expect(context.github.user.starred_repositories).toBe(7);
  expect(context.stars_given).toBe(7);
});

it("projects public template settings without credentials or arbitrary helper configuration", () => {
  const config = createConfig();
  config.github.token = "test-only-shared-credential";
  config.github.profiles = [{ username: "alice", token: "test-only-profile-credential" }];
  config.helpers = { privateService: "test-only-helper-credential" };
  config.github.apiUrl = "https://test-only-url-credential@example.com/api";

  const context = deriveContext(createOutput(), config);

  expect(JSON.stringify(context)).not.toContain("test-only-");
  expect(context.config.assets).toEqual(config.assets);
  expect(context.config.templates).toEqual(config.templates);
  expect(context.config.github.profiles).toEqual([{ username: "alice" }]);
  expect(context.config).not.toHaveProperty("helpers");
  expect(context.config.github).not.toHaveProperty("token");
  expect(config.github.token).toBe("test-only-shared-credential");
});

it("retains profiles and collection extras", () => {
  const output = createOutput();
  const extras = {
    profiles: [output.profile, createOutput("bob").profile],
    organizations: [{ id: 1, login: "organization" }],
    gists: [{ id: "gist" }],
  };

  const context = deriveContext(output, createConfig(), extras, true);

  expect(context.profiles).toBe(extras.profiles);
  expect(context.extras).toBe(extras);
  expect(context.organizations).toBe(extras.organizations);
  expect(context.orgs).toBe(extras.organizations);
  expect(context.extras.gists).toBe(extras.gists);
  expect(context).not.toHaveProperty("gists"); // Keep the callable template helper available.
  expect(context.multi_profile).toBe(true);
});

it("provides the collected profile when no profile extras were supplied", () => {
  const output = createOutput();

  const context = deriveContext(output, createConfig());

  expect(context.profiles).toEqual([output.profile]);
});

it("preserves canonical repository and contribution data in legacy context aliases", () => {
  const output = createOutput();

  const context = deriveContext(output, createConfig());

  expect(context.repositories).toBe(output.repositories);
  expect(context.github.user.repositories).toBe(output.repositories);
  expect(context.repo_contributions).toBe(output.profileContributions.repositoryContributions);
  expect(context.contributions.currentStreak).toBe(output.profileContributions.stats.currentStreak);
  expect(context.contributions.stats).toBe(output.profileContributions.stats);
  expect(context.traffic).toBe(output.repoMetrics.traffic);
  expect(context.collection_status).toBe(output.collectionStatus);
});

it("distinguishes uncollected pinned data from an empty collected list", () => {
  const context = deriveContext(createOutput(), createConfig());

  expect(context.github.user.pinned_repositories).toBeNull();
});

it("keeps pinned repositories when provided", () => {
  const pinned = [createRepository()];

  const context = deriveContext(createOutput(), createConfig(), { pinnedRepositories: pinned });

  expect(context.github.user.pinned_repositories).toBe(pinned);
});

it("preserves a genuinely collected empty pinned list", () => {
  const context = deriveContext(createOutput(), createConfig(), { pinnedRepositories: [] });

  expect(context.github.user.pinned_repositories).toEqual([]);
});

it("builds a typed explicitly uncollected placeholder instead of an invalid stats object", () => {
  const context = buildStubContext(createConfig());

  expect(context.stats.schemaVersion).toBe(2);
  expect(githubStatsOutputSchema.safeParse(context.stats).success).toBe(true);
  expect(context.stats.profileContributions.totalContributions).toBe(0);
  expect(context.stats).not.toHaveProperty("legacy");
  expect(context.stats.profileContributions.completeness.complete).toBe(false);
  expect(context.collection_status).toMatchObject({ coreComplete: false, complete: false });
  expect(context.stats.presentation.readmeSummary.complete).toBe(false);
  expect(context.github.user.pinned_repositories).toBeNull();
  expect(context.github.user.created_at).toBeNull();
  expect(context.profiles).toEqual([]);
});
