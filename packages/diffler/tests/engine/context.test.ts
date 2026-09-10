import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ContextBuilder } from "../../src/core/context.js";
import { collectProfiles } from "../../src/engine/index.js";
import { createConfig, createOutput, NOW } from "./fixtures.js";

vi.mock("../../src/engine/profiles.js", () => ({ collectProfiles: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(collectProfiles).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("uses the shared profile collection handoff for canonical template dependencies", async () => {
  const config = createConfig();
  const output = createOutput();
  vi.mocked(collectProfiles).mockResolvedValueOnce({ output, extras: {} });

  const context = await new ContextBuilder(config).build("{{ stats.repoMetrics.traffic.repoViews }}");

  expect(collectProfiles).toHaveBeenCalledWith(expect.objectContaining({ needsTraffic: true }), config);
  expect(context.stats).toBe(output);
  expect(context.multi_profile).toBe(false);
});

it("uses the shared aggregate and extras for multi-profile rendering", async () => {
  const config = createConfig();
  config.github.usernames = ["alice", "bob"];
  const output = createOutput();
  const profiles = [output.profile, createOutput("bob").profile];
  vi.mocked(collectProfiles).mockResolvedValueOnce({ output, extras: { profiles } });

  const context = await new ContextBuilder(config).build("{{ profile.name }}");

  expect(context.stats).toBe(output);
  expect(context.profiles).toBe(profiles);
  expect(context.multi_profile).toBe(true);
  expect(collectProfiles).toHaveBeenCalledTimes(1);
});

it("does not collect for a pure statically configured template", async () => {
  const config = createConfig();
  config.github.username = "arbitrary-configured-login";

  const context = await new ContextBuilder(config).build("{{ github_stats_card(config.github.username) }}");

  expect(collectProfiles).not.toHaveBeenCalled();
  expect(context.config).toMatchObject({ github: { username: "arbitrary-configured-login" } });
});

it("does not expose credentials through an uncollected config-only template", async () => {
  const config = createConfig();
  config.github.token = "test-only-shared-secret";
  config.github.profiles = [{ username: "alice", token: "test-only-profile-secret" }];
  config.helpers = { serviceToken: "test-only-helper-secret" };

  const context = await new ContextBuilder(config).build("{{ config | dump }}");

  expect(JSON.stringify(context)).not.toContain("test-only-");
  expect(context.config).toMatchObject({ assets: config.assets, github: { profiles: [{ username: "alice" }] } });
  expect(collectProfiles).not.toHaveBeenCalled();
});

it("propagates collection failure instead of rendering a successful stub", async () => {
  vi.mocked(collectProfiles).mockRejectedValueOnce(new Error("Failed to collect GitHub profile bob"));

  await expect(new ContextBuilder(createConfig()).build("{{ stats }}"))
    .rejects.toThrow("Failed to collect GitHub profile bob");
});

it("labels placeholder data incomplete when no profiles are configured", async () => {
  const config = createConfig();
  config.github.username = null;
  vi.spyOn(console, "warn").mockImplementation(() => {});

  const context = await new ContextBuilder(config).build("{{ profile.name }}");

  expect(context.collection_status).toMatchObject({ complete: false, coreComplete: false });
  expect(collectProfiles).not.toHaveBeenCalled();
});

it("does not shadow registered helpers with placeholder data in a static context", async () => {
  const context = await new ContextBuilder(createConfig()).build('{{ gists(config.github.username) }}');

  expect(context).not.toHaveProperty("gists");
  expect(context).not.toHaveProperty("stats");
  expect(collectProfiles).not.toHaveBeenCalled();
});
