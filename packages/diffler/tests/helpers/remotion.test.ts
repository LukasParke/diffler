import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { presentationSchema, sourcePropsSchema } from "@lukasparke/diffler-schemas";
import { Environment } from "nunjucks";
import { profileAsset, remotionInput, remotionSceneConfig, remotionSceneManifest } from "../../src/helpers/remotion.js";
import { registerAllHelpers } from "../../src/helpers/register.js";
import { collectedStats, FIXED_NOW } from "../cli/fixtures.js";
import { createFullV2 } from "../../../schemas/tests/fixtures.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

it("exports inline renderer SourceProps without flattening collected stats", () => {
  const stats = collectedStats();

  const input = remotionInput(stats);

  expect(input).toEqual({ username: "fixture-user", stats, allowPrivateRepositoryDetails: false });
  expect(sourcePropsSchema.safeParse(input).success).toBe(true);
});

it("keeps explicitly supported legacy stats inline rather than inventing a second flattened shape", () => {
  const stats = {
    username: "legacy-user", fetchedAt: FIXED_NOW.getTime(),
    totalContributions: 8, totalCommits: 6,
  };

  expect(remotionInput(stats)).toEqual({
    username: "legacy-user", stats, allowPrivateRepositoryDetails: false,
  });
});

it("strips unknown credential-bearing fields from exported stats", () => {
  const stats = collectedStats();
  const input = remotionInput({
    ...stats,
    token: "top-level-test-secret",
    config: { github: { token: "config-test-secret" } },
    profile: { ...stats.profile, token: "profile-test-secret" },
  });

  expect(input.stats).toEqual(stats);
  expect(JSON.stringify(input)).not.toContain("test-secret");
});

it.each([undefined, {}, { error: "private-error-details" }, { username: "incomplete-user" }])(
  "rejects invalid or uncollected stats without echoing their contents: %j",
  (stats) => {
    expect(() => remotionInput(stats)).toThrow(new Error(
      "Cannot export Remotion data: expected valid collected GitHub stats"
    ));
  }
);

it("requires an explicit opt-in for private stats", () => {
  const stats = collectedStats();
  stats.privacy.privateRepositoryDetailsIncluded = true;

  expect(() => remotionInput(stats)).toThrow("Private repository details require allowPrivateRepositoryDetails: true");
});

it("rejects marked private legacy repositories without a privacy report", () => {
  const stats = createFullV2().legacy;
  const legacy = {...stats, topRepos: stats.topRepos.map((repository) => ({...repository, isPrivate: true}))};

  expect(() => remotionInput(legacy)).toThrow("Private repository details require");
});

it("rejects marked private v2 repositories despite a public privacy report", () => {
  const stats = collectedStats();
  stats.repositories[0].isPrivate = true;

  expect(() => remotionInput(stats)).toThrow("Private repository details require");
});

it("honors explicit private opt-in for legacy repository details", () => {
  const stats = createFullV2().legacy;
  const legacy = {...stats, topRepos: stats.topRepos.map((repository) => ({...repository, isPrivate: true}))};

  expect(remotionInput(legacy, {allowPrivateRepositoryDetails: true}).stats).toEqual(legacy);
});

it("preserves the renderer privacy flag after an explicit opt-in", () => {
  const stats = collectedStats();
  stats.privacy.privateRepositoryDetailsIncluded = true;

  expect(remotionInput(stats, { allowPrivateRepositoryDetails: true })).toEqual({
    username: "fixture-user", stats, allowPrivateRepositoryDetails: true,
  });
});

it("exports descriptive scenes using the existing shared presentation shape and real card names", () => {
  const metadata = remotionSceneManifest(collectedStats());

  expect(metadata.scenes.map((scene) => scene.id)).toEqual([
    "readme", "activity-overview", "repo-impact", "languages",
  ]);
  expect(presentationSchema.shape.remotion.safeParse(metadata).success).toBe(true);
  expect(metadata).not.toHaveProperty("theme");
  expect(metadata.scenes[0]).not.toHaveProperty("durationInFrames");
  expect(metadata.scenes[0]).not.toHaveProperty("config");
});

it("keeps the scene-config helper as a metadata compatibility wrapper", () => {
  expect(remotionSceneConfig("intro", collectedStats())).toEqual({
    id: "readme", title: "Fixture User", metric: "fixture-user",
    supportingText: "GitHub profile activity",
  });
});

it("rejects unknown metadata card requests", () => {
  expect(() => remotionSceneConfig("not-a-card", collectedStats()))
    .toThrow("Unknown Remotion card; use a registered card ID");
});

it("accepts valid custom JSON metadata for any card in the shared registry", () => {
  const template = { scenes: [{ id: "stats", title: "Profile", metric: 7 }] };

  expect(remotionSceneManifest(collectedStats(), JSON.stringify(template))).toEqual(template);
});

it("rejects malformed scene JSON instead of silently falling back", () => {
  expect(() => remotionSceneManifest(collectedStats(), "{{ unsupported_template }}"))
    .toThrow("Scene metadata must be valid JSON; template rendering is not supported");
});

it("does not advertise unsupported theme effects in custom scene metadata", () => {
  expect(() => remotionSceneManifest(collectedStats(), JSON.stringify({
    scenes: [], theme: { primaryColor: "#000000" },
  }))).toThrow("theme, duration, and renderer config overrides are not supported");
});

it("rejects unregistered cards in custom metadata", () => {
  expect(() => remotionSceneManifest(collectedStats(), JSON.stringify({
    scenes: [{ id: "not-a-card", title: "Unavailable", metric: 0 }],
  }))).toThrow("Unknown Remotion card; use a registered card ID");
});

it("rejects unregistered scene IDs in supplied stats instead of promising nonexistent cards", () => {
  const stats = collectedStats();
  stats.presentation.remotion.scenes.push({ id: "not-a-card", title: "Unavailable", metric: 0 });

  expect(() => remotionSceneManifest(stats)).toThrow("Unknown Remotion card; use a registered card ID");
});

it("defaults asset links to this project's rendered assets directory", () => {
  expect(profileAsset()).toBe("./assets/readme.webp");
});

it("supports a public asset base URL and GIF format without changing renderer settings", () => {
  expect(profileAsset("activity-overview", { baseUrl: "https://example.com/profile/", format: "gif" }))
    .toBe("https://example.com/profile/activity-overview.gif");
});

it("rejects unsafe asset names", () => {
  expect(() => profileAsset("../../private-file")).toThrow("Invalid profile card name");
});

it("rejects asset names that are not in the shared renderer registry", () => {
  expect(() => profileAsset("not-a-card")).toThrow("Invalid profile card name");
});

it("rejects credential-bearing asset URLs without exposing their contents", () => {
  expect(() => profileAsset("readme", { baseUrl: "https://user:secret-token@example.com" }))
    .toThrow(new Error("Invalid profile asset settings: use a public asset base URL and webp or gif format"));
});

it("registers the canonical input and configurable asset helpers for templates", () => {
  const environment = new Environment();
  registerAllHelpers(environment);

  const input = environment.renderString("{{ remotion_input(stats) | dump | safe }}", { stats: collectedStats() });
  const asset = environment.renderString('{{ profile_asset("readme", {baseUrl: "https://example.com/cards", format: "gif"}) }}', {});

  expect(sourcePropsSchema.parse(JSON.parse(input)).stats).toEqual(collectedStats());
  expect(asset).toBe("https://example.com/cards/readme.gif");
});
