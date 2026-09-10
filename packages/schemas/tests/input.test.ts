import { expect, it } from "vitest";
import {
  githubStatsInputSchema,
  githubStatsOutputSchema,
  githubStatsV2InputSchema,
  legacyStatsInputSchema,
  sourcePropsSchema,
} from "../src/index.js";
import { createFullV2, createMinimalV2, fetchedAt } from "./fixtures.js";

it("projects historical v2 exports onto the canonical output contract", () => {
  const stats = createFullV2();
  const canonical = githubStatsOutputSchema.parse(stats);
  expect(canonical).toMatchObject({
    profile: stats.profile, profileContributions: stats.profileContributions,
    repoMetrics: stats.repoMetrics, packageMetrics: stats.packageMetrics,
    collectionStatus: stats.collectionStatus,
  });
  expect(canonical).not.toHaveProperty("legacy");
  expect(canonical).not.toHaveProperty("totalContributions");
  expect(githubStatsOutputSchema.parse(canonical)).toEqual(canonical);
});

it("accepts canonical minimal v2 without requiring legacy or presentation", () => {
  const stats = createMinimalV2();
  expect(githubStatsV2InputSchema.parse(stats)).toEqual(stats);
  expect(githubStatsOutputSchema.safeParse(stats).success).toBe(false);
});

it.each([
  undefined,
  null,
  [],
  {},
  "not JSON",
  { message: "Not Found", status: 404 },
  { error: "rate limited" },
])("rejects a non-stats response: %j", (value) => {
  expect(githubStatsInputSchema.safeParse(value).success).toBe(false);
});

it.each([0, 1, 3, "2", null])(
  "rejects an unsupported schema version: %j",
  (schemaVersion) => {
    expect(
      githubStatsInputSchema.safeParse({ ...createFullV2(), schemaVersion })
        .success,
    ).toBe(false);
  },
);

it("does not misclassify an unversioned v2 document as legacy", () => {
  expect(
    githubStatsInputSchema.safeParse({
      ...createFullV2(),
      schemaVersion: undefined,
    }).success,
  ).toBe(false);
});

it("rejects an error envelope even when it also includes stats fields", () => {
  expect(
    githubStatsInputSchema.safeParse({
      ...createFullV2(),
      error: "collection failed",
    }).success,
  ).toBe(false);
});

it("requires canonical profile identity", () => {
  const stats = createMinimalV2();
  expect(
    githubStatsInputSchema.safeParse({
      ...stats,
      profile: { ...stats.profile, login: "" },
    }).success,
  ).toBe(false);
});

it.each(["9", -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects malformed contribution counts: %j",
  (totalCommitContributions) => {
    const stats = createMinimalV2();
    expect(
      githubStatsInputSchema.safeParse({
        ...stats,
        profileContributions: {
          ...stats.profileContributions,
          totalCommitContributions,
        },
      }).success,
    ).toBe(false);
  },
);

it("rejects invalid calendar dates rather than normalizing them to another day", () => {
  const stats = createMinimalV2();
  expect(
    githubStatsInputSchema.safeParse({
      ...stats,
      profileContributions: {
        ...stats.profileContributions,
        contributionCalendar: {
          totalContributions: 1,
          weeks: [
            {
              contributionDays: [{ date: "2024-02-30", contributionCount: 1 }],
            },
          ],
        },
      },
    }).success,
  ).toBe(false);
});

it("rejects invalid generation timestamps", () => {
  expect(
    githubStatsInputSchema.safeParse({
      ...createMinimalV2(),
      generatedAt: "yesterday",
    }).success,
  ).toBe(false);
});

it("rejects impossible timestamp offsets even when they match the ISO string format", () => {
  expect(
    githubStatsInputSchema.safeParse({
      ...createMinimalV2(),
      generatedAt: "2024-01-04T12:00:00+99:99",
    }).success,
  ).toBe(false);
});

it("permits absent optional metric groups without inventing coverage", () => {
  const stats = createFullV2();
  const input = {
    ...stats,
    repoMetrics: {
      ...stats.repoMetrics,
      contributorStats: undefined,
      traffic: undefined,
    },
  };
  expect(
    githubStatsV2InputSchema.parse(input).repoMetrics?.contributorStats,
  ).toBeUndefined();
});

it("rejects a malformed supplied optional metric group", () => {
  const stats = createFullV2();
  expect(
    githubStatsInputSchema.safeParse({
      ...stats,
      repoMetrics: {
        ...stats.repoMetrics,
        contributorStats: { totalCommits: 0 },
      },
    }).success,
  ).toBe(false);
});

it("validates full versionless legacy exports", () => {
  const legacy = createFullV2().legacy;
  expect(legacyStatsInputSchema.parse(legacy)).toEqual(legacy);
});

it("explicitly supports compact legacy commitCount and name/bytes languages", () => {
  const legacy = legacyStatsInputSchema.parse({
    username: "octocat",
    fetchedAt,
    totalContributions: 2,
    commitCount: 2,
    topLanguages: [{ name: "TypeScript", bytes: 10 }],
  });
  expect(legacy.topLanguages).toStrictEqual([
    { languageName: "TypeScript", value: 10, color: null },
  ]);
});

it("does not accept identity alone as a legacy stats profile", () => {
  expect(
    legacyStatsInputSchema.safeParse({
      username: "octocat",
      fetchedAt,
      totalContributions: 0,
    }).success,
  ).toBe(false);
});

it("rejects malformed legacy fields even when other required data is valid", () => {
  expect(
    legacyStatsInputSchema.safeParse({
      ...createFullV2().legacy,
      linesAdded: "8",
    }).success,
  ).toBe(false);
});

it.each([
  {},
  { username: "" },
  { username: "../octocat" },
  { usernames: [] },
  { usernames: ["octocat", "OctoCat"] },
  { statsUrl: "file:///stats.json" },
  { statsUrl: "https://" },
  { stats: null },
  { stats: false },
  { username: "octocat", allowPrivateRepositoryDetails: "true" },
])("rejects invalid source props: %j", (props) => {
  expect(sourcePropsSchema.safeParse(props).success).toBe(false);
});

it("accepts explicit HTTP sources alongside a username", () => {
  const props = {
    username: "octocat",
    statsUrl: "https://example.com/stats.json",
  };
  expect(sourcePropsSchema.parse(props)).toEqual(props);
});
