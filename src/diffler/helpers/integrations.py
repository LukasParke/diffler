"""Third-party service integration helpers."""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)


def devto_posts(username: str, limit: int = 5) -> list[dict]:
    """Fetch recent Dev.to posts for a user.

    Args:
        username: Dev.to username.
        limit: Maximum number of posts to return.

    Returns:
        List of post dicts with keys: title, url, published_at, tags.
    """
    try:
        response = httpx.get(
            f"https://dev.to/api/articles",
            params={"username": username, "per_page": limit},
            timeout=15.0,
        )
        response.raise_for_status()
        articles = response.json()
        return [
            {
                "title": a.get("title", "Untitled"),
                "url": a.get("url", "#"),
                "published_at": a.get("published_at", ""),
                "tags": a.get("tag_list", []),
            }
            for a in articles[:limit]
        ]
    except Exception:
        logger.exception("Failed to fetch Dev.to posts for %s", username)
        return []


def recent_followers(username: str, token: str = "", limit: int = 20) -> list[dict]:
    """Fetch recent GitHub followers for a user.

    Args:
        username: GitHub username.
        token: Optional GitHub token for higher rate limits.
        limit: Maximum number of followers to return.

    Returns:
        List of follower dicts with keys: login, name, avatar_url, url.
    """
    headers = {}
    if token and not token.startswith("${"):
        headers["Authorization"] = f"Bearer {token}"
    try:
        response = httpx.get(
            f"https://api.github.com/users/{username}/followers",
            headers=headers,
            params={"per_page": limit},
            timeout=15.0,
        )
        response.raise_for_status()
        followers = response.json()
        return [
            {
                "login": f.get("login", "unknown"),
                "name": f.get("name") or f.get("login", "unknown"),
                "avatar_url": f.get("avatar_url", ""),
                "url": f.get("html_url", f"https://github.com/{f.get('login', '')}"),
            }
            for f in followers[:limit]
        ]
    except Exception:
        logger.exception("Failed to fetch followers for %s", username)
        return []


def rss_feed(url: str, limit: int = 5) -> list[dict]:
    """Parse a generic RSS or Atom feed.

    Args:
        url: RSS/Atom feed URL.
        limit: Maximum entries to return.

    Returns:
        List of entry dicts with keys: title, url, published.
    """
    try:
        response = httpx.get(url, timeout=15.0, follow_redirects=True)
        response.raise_for_status()
        text = response.text

        import re

        entries = []
        # Try RSS <item> tags
        items = re.findall(
            r"<item[^>]*>.*?</item>", text, re.DOTALL | re.IGNORECASE
        )
        if not items:
            # Try Atom <entry> tags
            items = re.findall(
                r"<entry[^>]*>.*?</entry>", text, re.DOTALL | re.IGNORECASE
            )

        for item in items[:limit]:
            title_match = re.search(
                r"<title[^>]*>(.*?)</title>", item, re.DOTALL | re.IGNORECASE
            )
            link_match = re.search(
                r'<link[^>]*href="([^"]+)"', item, re.IGNORECASE
            )
            if not link_match:
                link_match = re.search(
                    r"<link[^>]*>(.*?)</link>", item, re.DOTALL | re.IGNORECASE
                )
            pub_match = re.search(
                r"<pubDate[^>]*>(.*?)</pubDate>", item, re.DOTALL | re.IGNORECASE
            )
            if not pub_match:
                pub_match = re.search(
                    r"<published[^>]*>(.*?)</published>",
                    item,
                    re.DOTALL | re.IGNORECASE,
                )

            title = (title_match.group(1) if title_match else "Untitled").strip()
            title = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", title)

            link = ""
            if link_match:
                link = link_match.group(1).strip()

            published = ""
            if pub_match:
                published = pub_match.group(1).strip()

            entries.append(
                {"title": title, "url": link, "published": published}
            )

        return entries
    except Exception:
        logger.exception("Failed to parse RSS feed %s", url)
        return []


def profile_views_badge(username: str, style: str = "flat") -> str:
    """Generate a profile views counter badge.

    Uses a third-party counter service.

    Args:
        username: GitHub username.
        style: Shields.io style.

    Returns:
        Markdown image string for profile views.
    """
    return (
        f"![Profile Views](https://komarev.com/ghpvc/?"
        f"username={username}&style={style})"
    )


def remotion_asset(
    username: str,
    asset: str = "readme",
    format: str = "gif",
) -> str:
    """Generate a GitHub Pages URL for a github-stats-remotion asset.

    Assumes the remotion repo is named ``github-stats-remotion`` and
    publishes to GitHub Pages.

    Args:
        username: GitHub username.
        asset: Asset name without extension (e.g. "readme", "stats",
            "languages", "activity-overview", "commit-streak").
        format: File format — "gif" or "webp".

    Returns:
        Full URL to the remotion-generated asset.
    """
    return (
        f"https://{username}.github.io/github-stats-remotion/"
        f"{asset}.{format}"
    )
