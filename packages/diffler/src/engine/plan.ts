// Regexes to find Jinja2/Nunjucks variable references and function calls
const VAR_REF = /\{\{[\s\-]*([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
const FUNC_CALL = /\{\{[\s\-]*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
const TAG_VAR_REF =
  /\{%[\+\s\-]*(?:for\s+\w+\s+in|if|elif|set\s+\w+\s*=)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

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

const REF_MAP: Record<string, Array<keyof CollectionPlan>> = {
  profile: ["needsProfile"],
  github: ["needsProfile", "needsActivity", "needsDiscussions", "needsStarsGiven"],
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
  repo_stats: ["needsRepoStats"],
  computed_stats: ["needsComputedStats"],
};

export function analyzeTemplate(templateSource: string): CollectionPlan {
  const refs = new Set<string>();

  let m: RegExpExecArray | null;

  VAR_REF.lastIndex = 0;
  while ((m = VAR_REF.exec(templateSource)) !== null) {
    refs.add(m[1]);
  }

  FUNC_CALL.lastIndex = 0;
  while ((m = FUNC_CALL.exec(templateSource)) !== null) {
    refs.add(m[1]);
  }

  TAG_VAR_REF.lastIndex = 0;
  while ((m = TAG_VAR_REF.exec(templateSource)) !== null) {
    refs.add(m[1]);
  }

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

  for (const ref of refs) {
    const keys = REF_MAP[ref];
    if (keys) {
      for (const key of keys) {
        plan[key] = true;
      }
    }
  }

  // Core data is always needed if anything is referenced
  const anyNeeded = Object.values(plan).some(Boolean);
  if (anyNeeded) {
    plan.needsProfile = true;
    plan.needsContributions = true;
    plan.needsRepositories = true;
  }

  return plan;
}
