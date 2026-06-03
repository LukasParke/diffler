"""Recent activity and contribution helpers."""

from __future__ import annotations


def recent_activity_list(events: list[dict], limit: int = 5) -> str:
    """Generate a markdown list of recent GitHub activity.

    Args:
        events: List of GitHub event dicts.
        limit: Maximum number of events to show.

    Returns:
        Markdown list string.
    """
    if not events:
        return "_No recent activity._"

    lines = []
    for event in events[:limit]:
        event_type = event.get("type", "Unknown")
        repo = event.get("repo", {}).get("name", "unknown")
        payload = event.get("payload", {})

        if event_type == "PushEvent":
            commits = len(payload.get("commits", []))
            lines.append(f"- 📝 Pushed {commits} commit(s) to `{repo}`")
        elif event_type == "CreateEvent":
            ref_type = payload.get("ref_type", "something")
            lines.append(f"- 🆕 Created {ref_type} in `{repo}`")
        elif event_type == "PullRequestEvent":
            action = payload.get("action", "opened")
            lines.append(f"- 🔀 {action.capitalize()} a pull request in `{repo}`")
        elif event_type == "IssuesEvent":
            action = payload.get("action", "opened")
            lines.append(f"- 🐛 {action.capitalize()} an issue in `{repo}`")
        elif event_type == "ReleaseEvent":
            release = payload.get("release", {})
            tag = release.get("tag_name", "unknown")
            lines.append(f"- 🚀 Released `{tag}` in `{repo}`")
        elif event_type == "WatchEvent":
            lines.append(f"- ⭐ Starred `{repo}`")
        else:
            lines.append(f"- 📌 {event_type} in `{repo}`")

    return "\n".join(lines)


def contribution_badge(count: int) -> str:
    """Generate a contribution count badge.

    Args:
        count: Number of contributions.

    Returns:
        Markdown image string.
    """
    color = _contrib_color(count)
    return (
        f"![Contributions](https://img.shields.io/badge/"
        f"Contributions-{count}-{color}?style=flat)"
    )


def _contrib_color(count: int) -> str:
    """Return a color grade based on contribution count."""
    if count >= 1000:
        return "brightgreen"
    if count >= 500:
        return "green"
    if count >= 100:
        return "yellowgreen"
    if count >= 50:
        return "yellow"
    if count >= 10:
        return "orange"
    return "red"
