import { describe, it, expect } from "vitest";
import { analyzeTemplate } from "../../src/engine/plan.js";

describe("analyzeTemplate", () => {
  it("forces core collection when anything is referenced", () => {
    const plan = analyzeTemplate("{{ github.user.name }}");
    expect(plan.needsProfile).toBe(true);
    expect(plan.needsContributions).toBe(true);
    expect(plan.needsRepositories).toBe(true);
  });

  it("detects optional REST metrics through dotted v2 paths", () => {
    const plan = analyzeTemplate(
      "{{ stats.repoMetrics.traffic.repoViews }} {{ stats.repoMetrics.contributorStats.totalCommits }}"
    );
    expect(plan.needsTraffic).toBe(true);
    expect(plan.needsContributorStats).toBe(true);
  });

  it("detects optional REST metrics through bare references", () => {
    const plan = analyzeTemplate("{{ traffic }} {{ contributor_stats }}");
    expect(plan.needsTraffic).toBe(true);
    expect(plan.needsContributorStats).toBe(true);
  });

  it("leaves optional REST metrics off when the template does not use them", () => {
    const plan = analyzeTemplate(
      "{{ stats.repoMetrics.starCount }} {{ contributions.totalContributions }}"
    );
    expect(plan.needsTraffic).toBe(false);
    expect(plan.needsContributorStats).toBe(false);
  });

  it("does not force core collection for an empty template", () => {
    const plan = analyzeTemplate("");
    expect(Object.values(plan).some(Boolean)).toBe(false);
  });
});