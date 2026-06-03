"""Time formatting helpers (humanize / timeago)."""

from __future__ import annotations

from datetime import datetime, timezone


def _parse_iso(value: str) -> datetime | None:
    """Parse an ISO 8601 datetime string."""
    if not value:
        return None
    try:
        value = value.replace("Z", "+00:00")
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def humanize(value: str) -> str:
    """Convert an ISO datetime to a human-readable relative time.

    Examples:
        "2 hours ago"
        "3 days ago"
        "1 week ago"
        "2 months ago"

    Args:
        value: ISO 8601 datetime string.

    Returns:
        Human-readable relative time string.
    """
    dt = _parse_iso(value)
    if dt is None:
        return value

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())

    if seconds < 0:
        return "in the future"
    if seconds < 60:
        return "just now"
    if seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    if seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    if seconds < 604800:
        days = seconds // 86400
        return f"{days} day{'s' if days != 1 else ''} ago"
    if seconds < 2592000:
        weeks = seconds // 604800
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"
    if seconds < 31536000:
        months = seconds // 2592000
        return f"{months} month{'s' if months != 1 else ''} ago"

    years = seconds // 31536000
    return f"{years} year{'s' if years != 1 else ''} ago"


def short_date(value: str) -> str:
    """Convert an ISO datetime to a short date string.

    Args:
        value: ISO 8601 datetime string.

    Returns:
        Short date like "Jan 15, 2024".
    """
    dt = _parse_iso(value)
    if dt is None:
        return value
    return dt.strftime("%b %d, %Y")
