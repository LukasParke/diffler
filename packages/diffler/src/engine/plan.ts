import { parse } from "nunjucks/src/parser.js";
import type { RepoMetrics } from "@lukasparke/diffler-schemas";

export interface CollectionPlan {
  needsProfile: boolean;
  needsContributions: boolean;
  needsRepositories: boolean;
  needsOrganizations: boolean;
  needsGists: boolean;
  needsTraffic: boolean;
  needsContributorStats: boolean;
  needsActivity: boolean;
  needsDiscussions: boolean;
  needsStarsGiven: boolean;
  needsRepoStats: boolean;
  needsComputedStats: boolean;
}

const CORE: Array<keyof CollectionPlan> = ["needsProfile", "needsContributions", "needsRepositories"];
const STATS: Array<keyof CollectionPlan> = [
  ...CORE, "needsActivity", "needsDiscussions", "needsStarsGiven", "needsRepoStats", "needsComputedStats",
];
const ALL_STATS: Array<keyof CollectionPlan> = [...STATS, "needsTraffic", "needsContributorStats"];
const REPO_METRICS: Record<keyof RepoMetrics, Array<keyof CollectionPlan>> = {
  starCount: ["needsRepositories"],
  forkCount: ["needsRepositories"],
  codeByteTotal: ["needsRepositories"],
  topLanguages: ["needsRepositories"],
  topTopics: ["needsComputedStats"],
  traffic: ["needsTraffic"],
  contributorStats: ["needsContributorStats"],
  repoStats: ["needsRepoStats"],
  computedStats: ["needsComputedStats"],
  profile: ["needsRepositories"],
};
const REF_MAP: Record<string, Array<keyof CollectionPlan>> = {
  profile: ["needsProfile"],
  profiles: ["needsProfile"],
  github: STATS,
  user: ["needsProfile"],
  contributions: ["needsContributions"],
  streak: ["needsContributions"],
  calendar: ["needsContributions"],
  repositories: ["needsRepositories"],
  repos: ["needsRepositories"],
  organizations: ["needsOrganizations"],
  orgs: ["needsOrganizations"],
  gists: ["needsGists"],
  traffic: ["needsTraffic"],
  contributor_stats: ["needsContributorStats"],
  activity: ["needsActivity"],
  discussions: ["needsDiscussions"],
  stars_given: ["needsStarsGiven"],
  repo_contributions: ["needsContributions"],
  repo_stats: ["needsRepoStats"],
  computed_stats: ["needsComputedStats"],
  collection_status: ALL_STATS,
  extras: [...STATS, "needsOrganizations", "needsGists"],
  "extras.organizations": ["needsOrganizations"],
  "extras.gists": ["needsGists"],
  stats: ALL_STATS,
  "stats.profile": ["needsProfile"],
  "stats.profileContributions": ["needsContributions"],
  "stats.contributionsCollection": ["needsContributions"],
  "stats.contributionStats": ["needsContributions"],
  "stats.totalContributions": ["needsContributions"],
  "stats.totalCommits": ["needsContributions"],
  "stats.totalPullRequestReviews": ["needsContributions"],
  "stats.repositories": ["needsRepositories"],
  "stats.topRepos": ["needsRepositories"],
  "stats.activity": ["needsActivity"],
  "stats.presentation": STATS,
  "stats.repoMetrics": ALL_STATS,
  "stats.repoViews": ["needsTraffic"],
  "stats.commitCount": ["needsContributorStats"],
  "stats.linesAdded": ["needsContributorStats"],
  "stats.linesDeleted": ["needsContributorStats"],
  "stats.linesOfCodeChanged": ["needsContributorStats"],
};
for (const [name, requirements] of Object.entries(REPO_METRICS)) {
  REF_MAP[`stats.repoMetrics.${name}`] = requirements;
  REF_MAP[`stats.${name}`] = requirements;
}

export function analyzeTemplate(templateSource: string): CollectionPlan {
  const plan: CollectionPlan = {
    needsProfile: false,
    needsContributions: false,
    needsRepositories: false,
    needsOrganizations: false,
    needsGists: false,
    needsTraffic: false,
    needsContributorStats: false,
    needsActivity: false,
    needsDiscussions: false,
    needsStarsGiven: false,
    needsRepoStats: false,
    needsComputedStats: false,
  };
  const requireData = (keys: Array<keyof CollectionPlan>): void => {
    for (const key of keys) plan[key] = true;
  };
  const requirePath = (path: string[], locals: Set<string>): void => {
    if (locals.has(path[0])) return;
    const normalized = path[0] === "stats" && path[1] === "legacy"
      ? [path[0], ...path.slice(2)]
      : path;
    for (let length = normalized.length; length > 0; length--) {
      const key = normalized.slice(0, length).join(".");
      const keys = Object.hasOwn(REF_MAP, key) ? REF_MAP[key] : undefined;
      if (keys) {
        requireData(keys);
        return;
      }
    }
  };
  const walk = (value: unknown, locals: Set<string>): void => {
    if (Array.isArray(value)) {
      const children: unknown[] = value;
      for (const child of children) walk(child, locals);
      return;
    }
    if (!isNode(value)) return;
    switch (value.typename) {
      case "TemplateData":
      case "Literal":
        return;
      case "Symbol":
      case "LookupVal": {
        const path = referencePath(value);
        if (path) requirePath(path, locals);
        else {
          walk(value.target, locals);
          walk(value.val, locals);
        }
        return;
      }
      case "FunCall":
        if (isNode(value.name) && value.name.typename === "LookupVal") {
          walk(value.name, locals);
        }
        walk(value.args, locals);
        return;
      case "Filter":
        // Helper names are not context references; their arguments can be.
        walk(value.args, locals);
        return;
      case "Pair":
        walk(value.value, locals);
        return;
      case "Set":
        walk(value.value, locals);
        walk(value.body, new Set(locals));
        bindTargets(value.targets, locals);
        return;
      case "If":
      case "IfAsync":
      case "InlineIf":
        walk(value.cond, locals);
        if (isNode(value.cond) && value.cond.typename === "Literal" &&
          typeof value.cond.value === "boolean") {
          walk(value.cond.value ? value.body : value.else_, locals);
        } else {
          walk(value.body, new Set(locals));
          walk(value.else_, new Set(locals));
        }
        return;
      case "For":
      case "AsyncEach":
      case "AsyncAll": {
        walk(value.arr, locals);
        const loopLocals = new Set(locals);
        bindTargets(value.name, loopLocals);
        walk(value.body, loopLocals);
        walk(value.else_, locals);
        return;
      }
      case "Macro":
      case "Caller": {
        bindTargets(value.name, locals);
        const macroLocals = new Set(locals);
        bindTargets(value.args, macroLocals);
        walk(value.args, macroLocals);
        walk(value.body, macroLocals);
        return;
      }
      case "Import":
      case "FromImport":
      case "Include":
      case "Extends":
        // Dependencies outside this source cannot be resolved by this API.
        requireData([...ALL_STATS, "needsOrganizations", "needsGists"]);
        return;
      default:
        for (const child of Object.values(value)) walk(child, locals);
    }
  };

  try {
    walk(parse(templateSource), new Set());
  } catch {
    // Custom extensions/Jinja syntax may not parse without the renderer's environment.
    requireData([...ALL_STATS, "needsOrganizations", "needsGists"]);
  }
  if (Object.values(plan).some(Boolean)) requireData(CORE);
  return plan;
}

function isNode(value: unknown): value is Record<string, unknown> & { typename: string } {
  return typeof value === "object" && value !== null && "typename" in value &&
    typeof value.typename === "string";
}

function referencePath(value: unknown): string[] | undefined {
  if (!isNode(value)) return undefined;
  if (value.typename === "Symbol" && typeof value.value === "string") return [value.value];
  if (value.typename === "LookupVal" && isNode(value.val) && value.val.typename === "Literal" &&
    (typeof value.val.value === "string" || typeof value.val.value === "number")) {
    const target = referencePath(value.target);
    if (target) return [...target, String(value.val.value)];
  }
  return undefined;
}

function bindTargets(value: unknown, locals: Set<string>): void {
  if (Array.isArray(value)) {
    const targets: unknown[] = value;
    for (const target of targets) bindTargets(target, locals);
  } else if (isNode(value)) {
    if (value.typename === "Symbol" && typeof value.value === "string") locals.add(value.value);
    else if (value.typename === "Pair") bindTargets(value.key, locals);
    else bindTargets(value.children, locals);
  }
}
