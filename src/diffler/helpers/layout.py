"""Layout and structural Markdown helpers."""

from __future__ import annotations


def details(summary: str, content: str) -> str:
    """Wrap content in a collapsible details/summary block."""
    return f"<details>\n<summary>{summary}</summary>\n\n{content}\n\n</details>"


def center(content: str) -> str:
    """Wrap content in a centered div."""
    return f'<div align="center">\n\n{content}\n\n</div>'


def columns(items: list[str], count: int = 2) -> str:
    """Arrange items in a multi-column table layout."""
    if not items:
        return ""
    width = int(100 / count)
    cells = [f"<td width={width}% valign=top>{item}</td>" for item in items]
    rows = []
    for i in range(0, len(cells), count):
        row_cells = "".join(cells[i : i + count])
        rows.append(f"<tr>{row_cells}</tr>")
    return "<table>\n" + "\n".join(rows) + "\n</table>"
