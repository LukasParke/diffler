import { expect, it } from "vitest";
import type { RepositoryRecord } from "@lukasparke/diffler-schemas";
import { filterRepos, reposByLanguage, languageBreakdown } from "../../src/helpers/filters.js";
import { createRepository } from "../engine/fixtures.js";

const repos = [
  { name: "alpha", full_name: "user/alpha", stars: 100, primary_language: "TypeScript", is_fork: false, is_archived: false, description: "Alpha project" },
  { name: "beta", full_name: "user/beta", stars: 50, primary_language: "Python", is_fork: true, is_archived: false, description: "Beta project" },
  { name: "gamma", full_name: "user/gamma", stars: 200, primary_language: "TypeScript", is_fork: false, is_archived: true, description: "Gamma project" },
  { name: "delta", full_name: "user/delta", stars: 10, primary_language: "Go", is_fork: false, is_archived: false, description: null },
];

it("returns all legacy repositories by default", () => {
  expect(filterRepos(repos)).toHaveLength(4);
});

it("excludes legacy forks", () => {
  expect(filterRepos(repos, { exclude_forks: true }).map((repo) => repo.name))
    .toEqual(["gamma", "alpha", "delta"]);
});

it("excludes legacy archived repositories", () => {
  expect(filterRepos(repos, { exclude_archived: true }).map((repo) => repo.name))
    .toEqual(["alpha", "beta", "delta"]);
});

it("filters legacy languages case-insensitively", () => {
  expect(filterRepos(repos, { language: "typescript" }).map((repo) => repo.name)).toEqual(["gamma", "alpha"]);
});

it("filters repositories by minimum stars", () => {
  expect(filterRepos(repos, { min_stars: 50 }).map((repo) => repo.name)).toEqual(["gamma", "alpha", "beta"]);
});

it("filters repositories by maximum stars", () => {
  expect(filterRepos(repos, { max_stars: 50 }).map((repo) => repo.name)).toEqual(["beta", "delta"]);
});

it("searches repository names and descriptions", () => {
  expect(filterRepos(repos, { search: "Gamma project" }).map((repo) => repo.name)).toEqual(["gamma"]);
});

it("sorts by stars descending by default", () => {
  expect(filterRepos(repos).map((repo) => repo.name)).toEqual(["gamma", "alpha", "beta", "delta"]);
});

it("supports ascending name order", () => {
  expect(filterRepos(repos, { sort_by: "name", sort_desc: false }).map((repo) => repo.name))
    .toEqual(["alpha", "beta", "delta", "gamma"]);
});

it("limits filtered results", () => {
  expect(filterRepos(repos, { limit: 2 }).map((repo) => repo.name)).toEqual(["gamma", "alpha"]);
});

it("groups legacy repositories by language and sorts each group by stars", () => {
  const result = reposByLanguage(repos);

  expect(Object.keys(result)).toEqual(["Go", "Python", "TypeScript"]);
  expect(result.TypeScript.map((repo) => repo.name)).toEqual(["gamma", "alpha"]);
});

it("summarizes legacy languages", () => {
  expect(languageBreakdown(repos)).toEqual([
    { language: "TypeScript", count: 2, total_stars: 300, color: null },
    { language: "Python", count: 1, total_stars: 50, color: null },
    { language: "Go", count: 1, total_stars: 10, color: null },
  ]);
});

it("excludes v2 forks using isFork", () => {
  const repositories: RepositoryRecord[] = [
    createRepository({ name: "original", stars: 1 }),
    createRepository({ name: "fork", stars: 100, isFork: true }),
  ];

  expect(filterRepos(repositories, { exclude_forks: true }).map((repo) => repo.name)).toEqual(["original"]);
});

it("excludes v2 archived repositories using isArchived", () => {
  const repositories: RepositoryRecord[] = [
    createRepository({ name: "active", stars: 1 }),
    createRepository({ name: "archived", stars: 100, isArchived: true }),
  ];

  expect(filterRepos(repositories, { exclude_archived: true }).map((repo) => repo.name)).toEqual(["active"]);
});

it("normalizes v2 language, identity, colors, and counters for legacy helper outputs", () => {
  const repository = createRepository();

  expect(filterRepos([repository], { language: "typescript", search: "alice/project" })).toEqual([{
    name: "project",
    full_name: "alice/project",
    description: "A project",
    url: "https://github.com/alice/project",
    stars: 10,
    forks: 2,
    language: "TypeScript",
    language_color: "#3178c6",
    is_fork: false,
    is_archived: false,
  }]);
});

it("groups typed v2 repositories without discarding their data", () => {
  const first = createRepository({ stars: 1 });
  const second = createRepository({ stars: 5 });

  const result = reposByLanguage([first, second]);

  expect(result.TypeScript).toEqual([second, first]);
  expect(result.TypeScript[0]).toBe(second);
});

it("summarizes v2 primary languages with their typed language colors", () => {
  expect(languageBreakdown([createRepository(), createRepository({ stars: 20 })])).toEqual([
    { language: "TypeScript", count: 2, total_stars: 30, color: "#3178c6" },
  ]);
});

it("preserves explicit v2 false and zero values over legacy fallbacks", () => {
  const repository = {
    ...createRepository({ isFork: false, isArchived: false, stars: 0 }),
    is_fork: true,
    is_archived: true,
    stargazers_count: 100,
  };

  expect(filterRepos([repository], { exclude_forks: true, exclude_archived: true, max_stars: 0 }))
    .toHaveLength(1);
});

it("retains documented snake-case language colors", () => {
  const repository = { ...repos[0], primary_language_color: "#3178c6" };

  expect(filterRepos([repository])[0].language_color).toBe("#3178c6");
  expect(languageBreakdown([repository])[0].color).toBe("#3178c6");
});

it("accepts previously normalized helper results as input to language helpers", () => {
  const filtered = filterRepos(repos);

  expect(reposByLanguage(filtered).TypeScript).toHaveLength(2);
  expect(languageBreakdown(filtered)[0]).toMatchObject({ language: "TypeScript", count: 2, total_stars: 300 });
});

it("narrows malformed values rather than trusting truthiness or unchecked casts", () => {
  const malformed = {
    name: 123, full_name: [], description: false, url: 1, stars: "100", forks: Number.NaN,
    primary_language: {}, primary_language_color: 1, is_fork: "true", is_archived: "false",
  };

  expect(filterRepos([malformed])).toEqual([{
    name: "", full_name: "", description: null, url: "", stars: 0, forks: 0,
    language: null, language_color: null, is_fork: false, is_archived: false,
  }]);
});

it("handles null v2 languages as unknown instead of falling back to stale snake-case metadata", () => {
  const repository = { ...createRepository({ primaryLanguage: null }), primary_language: "stale" };

  expect(Object.keys(reposByLanguage([repository]))).toEqual(["Unknown"]);
});

it("handles language names that collide with object prototype keys", () => {
  const repository = { name: "special", primary_language: "__proto__", stars: 1 };

  expect(reposByLanguage([repository])["__proto__"]).toEqual([repository]);
  expect(languageBreakdown([repository])).toEqual([
    { language: "__proto__", count: 1, total_stars: 1, color: null },
  ]);
});

it("does not mutate repository inputs while normalizing or sorting", () => {
  const original = structuredClone(repos);

  filterRepos(repos);
  reposByLanguage(repos);
  languageBreakdown(repos);

  expect(repos).toEqual(original);
});
