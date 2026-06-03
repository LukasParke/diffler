"""Badge and shield helpers."""

from __future__ import annotations

import urllib.parse


def shield(label: str, message: str, color: str = "blue", style: str = "flat") -> str:
    """Generate a Shields.io badge markdown string."""
    encoded_label = urllib.parse.quote(str(label).replace("-", "--"))
    encoded_message = urllib.parse.quote(str(message).replace("-", "--"))
    url = f"https://img.shields.io/badge/{encoded_label}-{encoded_message}-{color}?style={style}"
    return f"![{label}]({url})"


def social(icon: str, url: str, label: str | None = None) -> str:
    """Generate a social link badge."""
    text = label or icon.capitalize()
    return f"[{text}]({url})"


def license_badge(repo: str, username: str | None = None) -> str:
    """Generate a GitHub license badge."""
    if username:
        repo = f"{username}/{repo}"
    return f"![License](https://img.shields.io/github/license/{repo})"


def version_badge(package: str, manager: str = "pypi") -> str:
    """Generate a package version badge."""
    if manager == "pypi":
        return f"![PyPI](https://img.shields.io/pypi/v/{package})"
    if manager == "npm":
        return f"![npm](https://img.shields.io/npm/v/{package})"
    return ""


def github_stats_card(username: str, theme: str = "default") -> str:
    """Generate a GitHub stats card image markdown."""
    url = f"https://github-readme-stats.vercel.app/api?username={username}&theme={theme}"
    return f"![GitHub Stats]({url})"


def top_langs(username: str, theme: str = "default") -> str:
    """Generate a top languages card image markdown."""
    url = (
        f"https://github-readme-stats.vercel.app/api/top-langs/"
        f"?username={username}&layout=compact&theme={theme}"
    )
    return f"![Top Languages]({url})"


def streak_stats(username: str, theme: str = "default") -> str:
    """Generate a GitHub streak stats card image markdown."""
    url = f"https://github-readme-streak-stats.herokuapp.com/?user={username}&theme={theme}"
    return f"![GitHub Streak]({url})"


def typing_svg(text: str, duration: int = 5000) -> str:
    """Generate a typing SVG animation markdown."""
    encoded = urllib.parse.quote(text)
    url = f"https://readme-typing-svg.herokuapp.com?duration={duration}&lines={encoded}"
    return f"![Typing SVG]({url})"


def skill_icons(technologies: list[str], theme: str = "dark") -> str:
    """Generate a skill icons image markdown."""
    icons = ",".join(technologies)
    url = f"https://skillicons.dev/icons?i={icons}&theme={theme}"
    return f"![Skills]({url})"
