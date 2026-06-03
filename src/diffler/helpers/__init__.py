"""Built-in template helpers for Diffler."""

from __future__ import annotations

from jinja2 import Environment

from diffler.config import DifflerConfig
from diffler.helpers import activity, badges, filters, integrations, layout, remotion, repos, sources, stats_data, timefmt


def register_all_helpers(env: Environment, config: DifflerConfig) -> None:
    """Register all built-in helpers as Jinja2 globals and filters."""
    env.globals.update(
        {
            # Badges
            "shield": badges.shield,
            "social": badges.social,
            "license_badge": badges.license_badge,
            "version_badge": badges.version_badge,
            # Layout
            "details": layout.details,
            "center": layout.center,
            "columns": layout.columns,
            # Greeting
            "greeting": lambda: "Hello! Welcome to my profile.",
            # Stats cards
            "github_stats_card": badges.github_stats_card,
            "top_langs": badges.top_langs,
            "streak_stats": badges.streak_stats,
            "typing_svg": badges.typing_svg,
            "skill_icons": badges.skill_icons,
            # Repositories
            "repo_card": repos.repo_card,
            "pinned_repos_grid": repos.pinned_repos_grid,
            "repo_list": repos.repo_list,
            # Repo filtering
            "filter_repos": filters.filter_repos,
            "repos_by_language": filters.repos_by_language,
            "language_breakdown": filters.language_breakdown,
            # Data sources
            "github_events": sources.github_events,
            "recent_stars": sources.recent_stars,
            "gists": sources.gists,
            "releases": sources.releases,
            "sponsors": sources.sponsors,
            "fetch_json": sources.fetch_json,
            # Stats JSON (stats-action integration)
            "stats_json": stats_data.stats_json,
            "contribution_calendar": stats_data.contribution_calendar,
            "streak_info": stats_data.streak_info,
            "top_languages_from_stats": stats_data.top_languages_from_stats,
            "language_bar_chart": stats_data.language_bar_chart,
            "repo_traffic_summary": stats_data.repo_traffic_summary,
            "activity_timeline": stats_data.activity_timeline,
            "highlights": stats_data.highlights,
            "readme_summary": stats_data.readme_summary,
            # Remotion
            "remotion_input": remotion.remotion_input,
            "remotion_scene_config": remotion.remotion_scene_config,
            # Integrations
            "devto_posts": integrations.devto_posts,
            "recent_followers": integrations.recent_followers,
            "rss_feed": integrations.rss_feed,
            "profile_views_badge": integrations.profile_views_badge,
            "remotion_asset": integrations.remotion_asset,
            # Activity
            "recent_activity_list": activity.recent_activity_list,
            "contribution_badge": activity.contribution_badge,
            # Time formatting
            "humanize": timefmt.humanize,
            "short_date": timefmt.short_date,
        }
    )
