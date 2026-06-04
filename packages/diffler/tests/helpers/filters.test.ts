import { describe, it, expect } from "vitest";
import { filterRepos, reposByLanguage, languageBreakdown } from "../../src/helpers/filters.js";

describe("filters", () => {
  const repos = [
    { name: "alpha", full_name: "user/alpha", stars: 100, primary_language: "TypeScript", is_fork: false, is_archived: false, description: "Alpha project" },
    { name: "beta", full_name: "user/beta", stars: 50, primary_language: "Python", is_fork: true, is_archived: false, description: "Beta project" },
    { name: "gamma", full_name: "user/gamma", stars: 200, primary_language: "TypeScript", is_fork: false, is_archived: true, description: "Gamma project" },
    { name: "delta", full_name: "user/delta", stars: 10, primary_language: "Go", is_fork: false, is_archived: false, description: null },
  ];

  describe("filterRepos", () => {
    it("returns all repos by default", () => {
      const result = filterRepos(repos);
      expect(result).toHaveLength(4);
    });

    it("excludes forks", () => {
      const result = filterRepos(repos, { exclude_forks: true });
      expect(result.map((r) => r.name)).toEqual(["gamma", "alpha", "delta"]);
    });

    it("excludes archived", () => {
      const result = filterRepos(repos, { exclude_archived: true });
      expect(result.map((r) => r.name)).toEqual(["alpha", "beta", "delta"]);
    });

    it("filters by language", () => {
      const result = filterRepos(repos, { language: "TypeScript" });
      expect(result).toHaveLength(2);
    });

    it("filters by min_stars", () => {
      const result = filterRepos(repos, { min_stars: 50 });
      expect(result).toHaveLength(3);
    });

    it("searches by name or description", () => {
      const result = filterRepos(repos, { search: "gamma" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("gamma");
    });

    it("sorts by stars descending", () => {
      const result = filterRepos(repos);
      expect(result[0].name).toBe("gamma");
      expect(result[1].name).toBe("alpha");
    });

    it("limits results", () => {
      const result = filterRepos(repos, { limit: 2 });
      expect(result).toHaveLength(2);
    });
  });

  describe("reposByLanguage", () => {
    it("groups repos by language", () => {
      const result = reposByLanguage(repos);
      expect(Object.keys(result)).toContain("TypeScript");
      expect(Object.keys(result)).toContain("Python");
      expect(result.TypeScript).toHaveLength(2);
    });
  });

  describe("languageBreakdown", () => {
    it("summarizes languages", () => {
      const result = languageBreakdown(repos);
      expect(result.length).toBeGreaterThan(0);
      const ts = result.find((r) => r.language === "TypeScript");
      expect(ts?.count).toBe(2);
      expect(ts?.total_stars).toBe(300);
    });
  });
});
