import { expect, it } from "vitest";
import { analyzeTemplate } from "../../src/engine/index.js";

it("plans canonical traffic metrics", () => {
  expect(analyzeTemplate("{{ stats.repoMetrics.traffic.repoViews }}")).toMatchObject({
    needsProfile: true, needsContributions: true, needsRepositories: true,
    needsTraffic: true, needsContributorStats: false,
  });
});

it("plans canonical contributor metrics", () => {
  expect(analyzeTemplate("{{ stats.repoMetrics.contributorStats.linesAdded }}")).toMatchObject({
    needsContributorStats: true, needsTraffic: false,
  });
});

it("plans canonical bracket lookups", () => {
  expect(analyzeTemplate('{{ stats["repoMetrics"]["traffic"]["repoViews"] }}').needsTraffic).toBe(true);
});

it("finds dependencies in helper arguments rather than only the first symbol", () => {
  expect(analyzeTemplate('{{ humanize(stats.repoMetrics.traffic.repoViews) }}').needsTraffic).toBe(true);
});

it("collects repositories used as a method-call receiver", () => {
  expect(analyzeTemplate("{{ repositories.slice(0, 1) | dump }}").needsRepositories).toBe(true);
});

it("collects a profile used by a nested method-call receiver", () => {
  expect(analyzeTemplate("{{ github.user.name.toUpperCase() }}").needsProfile).toBe(true);
});

it("does not collect for method calls on static local data", () => {
  expect(Object.values(analyzeTemplate('{% set repositories = [] %}{{ repositories.slice(0, 1) }}')).some(Boolean)).toBe(false);
});

it("finds dependencies on either side of an expression", () => {
  expect(analyzeTemplate('{{ "views: " ~ stats.repoMetrics.traffic.repoViews }}').needsTraffic).toBe(true);
});

it("finds dependencies in control flow and assignments", () => {
  expect(analyzeTemplate('{% if false or stats.repoMetrics.contributorStats.totalCommits > 0 %}{% set views = stats.repoMetrics.traffic.repoViews %}{{ views }}{% endif %}'))
    .toMatchObject({ needsTraffic: true, needsContributorStats: true });
});

it("does not plan optional metrics for canonical repository star counts", () => {
  expect(analyzeTemplate("{{ stats.repoMetrics.starCount }}")).toMatchObject({
    needsRepositories: true, needsTraffic: false, needsContributorStats: false,
  });
});

it("keeps derived repository statistics independent of optional REST metrics", () => {
  expect(analyzeTemplate("{{ stats.repoMetrics.repoStats.totalRepos }} {{ stats.repoMetrics.computedStats.languageCount }}"))
    .toMatchObject({ needsRepoStats: true, needsComputedStats: true, needsTraffic: false, needsContributorStats: false });
});

it("conservatively plans optional metrics when the whole stats object is passed to a helper", () => {
  expect(analyzeTemplate("{{ plugin(stats) }}")).toMatchObject({ needsTraffic: true, needsContributorStats: true });
});

it("recognizes legacy optional metric aliases", () => {
  expect(analyzeTemplate("{{ stats.legacy.repoViews }} {{ stats.legacy.commitCount }}"))
    .toMatchObject({ needsTraffic: true, needsContributorStats: true });
});

it("preserves canonical optional dependencies through local aliases", () => {
  expect(analyzeTemplate("{% set metrics = stats.repoMetrics %}{{ metrics.traffic.repoViews }}"))
    .toMatchObject({ needsTraffic: true });
});

it("does not collect for pure literal helper calls", () => {
  const plan = analyzeTemplate('{{ github_stats_card("a-configured-login") }} {{ shield("traffic", "stats", "blue") }}');

  expect(Object.values(plan).some(Boolean)).toBe(false);
});

it("does not collect for statically configured helper arguments", () => {
  const plan = analyzeTemplate("{{ github_stats_card(config.github.username) }}");

  expect(Object.values(plan).some(Boolean)).toBe(false);
});

it("ignores reference-looking text in comments, strings, and raw blocks", () => {
  const plan = analyzeTemplate('{# {{ traffic }} #} {{ "stats.repoMetrics.contributorStats" }} {% raw %}{{ organizations }}{% endraw %}');

  expect(Object.values(plan).some(Boolean)).toBe(false);
});

it("does not confuse pure helper names with context data of the same name", () => {
  const plan = analyzeTemplate('{{ gists("a-configured-login") }}');

  expect(Object.values(plan).some(Boolean)).toBe(false);
});

it("does plan a bare gists context reference", () => {
  expect(analyzeTemplate("{{ gists | length }}").needsGists).toBe(true);
});

it("does not collect for statically defined local values that shadow context names", () => {
  const plan = analyzeTemplate('{% set profile = { name: "local" } %}{{ profile.name }}');

  expect(Object.values(plan).some(Boolean)).toBe(false);
});

it("does not collect for local loop bindings over literal data", () => {
  const plan = analyzeTemplate('{% for profile in [{ name: "local" }] %}{{ profile.name }}{% endfor %}');

  expect(Object.values(plan).some(Boolean)).toBe(false);
});

it("does not treat keyword argument names as context dependencies", () => {
  const plan = analyzeTemplate('{{ helper(profile="literal", traffic=0, gists=[]) }}');

  expect(Object.values(plan).some(Boolean)).toBe(false);
});

it("resolves pure macro parameters without requesting profile data", () => {
  const plan = analyzeTemplate('{% macro card(profile) %}{{ profile.name }}{% endmacro %}{{ card({name: "local"}) }}');

  expect(Object.values(plan).some(Boolean)).toBe(false);
});

it("does not ignore context dependencies in macro defaults", () => {
  expect(analyzeTemplate('{% macro card(count=stats.repoMetrics.traffic.repoViews) %}{{ count }}{% endmacro %}{{ card() }}').needsTraffic)
    .toBe(true);
});

it("plans uninspectable included templates conservatively", () => {
  expect(analyzeTemplate('{% include "metrics.j2" %}')).toMatchObject({
    needsTraffic: true, needsContributorStats: true, needsOrganizations: true, needsGists: true,
  });
});

it("does not collect for a statically unreachable data reference", () => {
  const plan = analyzeTemplate('{% if false %}{{ stats.repoMetrics.traffic }}{% else %}Static{% endif %}');

  expect(Object.values(plan).some(Boolean)).toBe(false);
});

it("does not let a conditional local assignment hide a required context reference", () => {
  const plan = analyzeTemplate('{% if config.helpers.local %}{% set profile = {name: "local"} %}{% endif %}{{ profile.name }}');

  expect(plan.needsProfile).toBe(true);
});

it("does not confuse object prototype names with collection dependencies", () => {
  const plan = analyzeTemplate("{{ constructor }} {{ toString }}");

  expect(Object.values(plan).some(Boolean)).toBe(false);
});
