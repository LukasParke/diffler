"""Repository and project showcase helpers."""

from __future__ import annotations


def repo_card(repo: dict, show_language: bool = True, show_stars: bool = True) -> str:
    """Generate a markdown repository card.

    Args:
        repo: Repository dict with keys: name, full_name, description, url,
            stars, forks, language, language_color.
        show_language: Whether to show the primary language badge.
        show_stars: Whether to show the star count.

    Returns:
        Markdown string for the repository card.
    """
    name = repo.get("name") or "unknown"
    url = repo.get("url") or "#"
    desc = repo.get("description") or ""
    stars = repo.get("stars") or 0
    language = repo.get("language")
    color = repo.get("language_color") or "blue"

    lines = [f"### [{name}]({url})"]
    if desc:
        lines.append(desc)
    badges = []
    if show_stars:
        badges.append(f"⭐ {stars}")
    if show_language and language:
        badges.append(f"`{language}`")
    if badges:
        lines.append(" · ".join(badges))
    return "\n\n".join(lines)


def pinned_repos_grid(repos: list[dict], columns: int = 2) -> str:
    """Generate a grid of pinned repository cards.

    Args:
        repos: List of repository dicts.
        columns: Number of columns in the grid.

    Returns:
        Markdown table layout for the repository grid.
    """
    if not repos:
        return ""

    width = int(100 / columns)
    cells = []
    for repo in repos:
        card = repo_card(repo)
        cells.append(f"<td width={width}% valign=top>\n\n{card}\n\n</td>")

    rows = []
    for i in range(0, len(cells), columns):
        row_cells = "\n".join(cells[i : i + columns])
        rows.append(f"<tr>\n{row_cells}\n</tr>")

    return "<table>\n" + "\n".join(rows) + "\n</table>"


def repo_list(repos: list[dict], limit: int = 5) -> str:
    """Generate a bulleted list of repositories.

    Args:
        repos: List of repository dicts.
        limit: Maximum number of repos to show.

    Returns:
        Markdown list string.
    """
    lines = []
    for repo in repos[:limit]:
        name = repo.get("name") or "unknown"
        url = repo.get("url") or "#"
        desc = repo.get("description") or ""
        stars = repo.get("stars") or 0
        line = f"- **[{name}]({url})** — {desc} ⭐ {stars}"
        lines.append(line)
    return "\n".join(lines)
