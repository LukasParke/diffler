import type { Environment } from "nunjucks";
import * as badges from "./badges.js";
import * as filters from "./filters.js";
import * as layout from "./layout.js";
import * as timefmt from "./timefmt.js";
import * as integrations from "./integrations.js";
import * as sources from "./sources.js";
import * as remotion from "./remotion.js";
import { SourceStore } from "./prefetch.js";

export function registerAllHelpers(env: Environment, sourceStore = new SourceStore()): void {
  env.addGlobal("shield", badges.shield);
  env.addGlobal("social", badges.social);
  env.addGlobal("license_badge", badges.licenseBadge);
  env.addGlobal("version_badge", badges.versionBadge);
  env.addGlobal("github_stats_card", badges.githubStatsCard);
  env.addGlobal("top_langs", badges.topLangs);
  env.addGlobal("streak_stats", badges.streakStats);
  env.addGlobal("typing_svg", badges.typingSvg);
  env.addGlobal("skill_icons", badges.skillIcons);

  env.addGlobal("details", layout.details);
  env.addGlobal("center", layout.center);
  env.addGlobal("columns", layout.columns);

  env.addGlobal("filter_repos", filters.filterRepos);
  env.addGlobal("repos_by_language", filters.reposByLanguage);
  env.addGlobal("language_breakdown", filters.languageBreakdown);

  env.addGlobal("humanize", timefmt.humanize);
  env.addGlobal("short_date", timefmt.shortDate);

  env.addGlobal("devto_posts", integrations.devtoPosts(sourceStore));
  env.addGlobal("rss_feed", integrations.rssFeed(sourceStore));
  env.addGlobal("profile_views_badge", integrations.profileViewsBadge);
  env.addGlobal("remotion_asset", integrations.remotionAsset);

  env.addGlobal("github_events", sources.githubEvents(sourceStore));
  env.addGlobal("recent_stars", sources.recentStars(sourceStore));
  env.addGlobal("gists", sources.gists(sourceStore));
  env.addGlobal("releases", sources.releases(sourceStore));
  env.addGlobal("sponsors", sources.sponsors(sourceStore));
  env.addGlobal("fetch_json", integrations.fetchJson(sourceStore));

  env.addGlobal("remotion_input", remotion.remotionInput);
  env.addGlobal("remotion_scene_config", remotion.remotionSceneConfig);
  env.addGlobal("remotion_scene_manifest", remotion.remotionSceneManifest);
}
