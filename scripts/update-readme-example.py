#!/usr/bin/env python3
"""Auto-update the rendered example section in README.md.

Reads examples/readme-example.md.j2, renders it with live GitHub data,
and replaces the content between <!-- DIFFLER-EXAMPLE-START --> and
<!-- DIFFLER-EXAMPLE-END --> markers in README.md.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from diffler.config import DifflerConfig
from diffler.core.context import ContextBuilder
from jinja2 import Environment

REPO_ROOT = Path(__file__).parent.parent
README_PATH = REPO_ROOT / "README.md"
TEMPLATE_PATH = REPO_ROOT / "examples" / "readme-example.md.j2"

START_MARKER = "<!-- DIFFLER-EXAMPLE-START -->"
END_MARKER = "<!-- DIFFLER-EXAMPLE-END -->"


def render_example() -> str:
    """Render the example template with live data."""
    config = DifflerConfig.from_env()
    if not config.github.username:
        config.github.username = "LukasParke"

    builder = ContextBuilder(config)
    template_source = TEMPLATE_PATH.read_text(encoding="utf-8")
    context = builder.build(template_source)

    env = Environment()
    return env.from_string(template_source).render(**context)


def update_readme(rendered: str) -> bool:
    """Replace the example section in README.md."""
    readme = README_PATH.read_text(encoding="utf-8")

    pattern = re.compile(
        re.escape(START_MARKER) + r".*" + re.escape(END_MARKER),
        re.DOTALL,
    )

    replacement = f"{START_MARKER}\n{rendered}\n{END_MARKER}"
    new_readme, count = pattern.subn(replacement, readme)

    if count == 0:
        print("ERROR: Could not find example markers in README.md")
        return False

    if new_readme == readme:
        print("No changes to README.md")
        return False

    README_PATH.write_text(new_readme, encoding="utf-8")
    print("Updated README.md example section")
    return True


if __name__ == "__main__":
    rendered = render_example()
    changed = update_readme(rendered)
    sys.exit(0 if changed else 0)
