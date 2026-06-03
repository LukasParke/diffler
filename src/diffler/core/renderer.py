"""Jinja2 template environment setup and rendering."""

from __future__ import annotations

import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from diffler.config import DifflerConfig
from diffler.helpers import register_all_helpers

logger = logging.getLogger(__name__)

BUILTIN_TEMPLATES = Path(__file__).parent.parent / "templates" / "builtins"


class Renderer:
    """Manages the Jinja2 environment and template rendering."""

    def __init__(self, config: DifflerConfig) -> None:
        self.config = config
        self.env = self._build_environment()
        register_all_helpers(self.env, config)

    def _build_environment(self) -> Environment:
        paths: list[str] = []
        if self.config.templates.directory.exists():
            paths.append(str(self.config.templates.directory))
        if self.config.templates.builtins and BUILTIN_TEMPLATES.exists():
            paths.append(str(BUILTIN_TEMPLATES))

        if not paths:
            raise RuntimeError(
                f"No template directories found. Expected {self.config.templates.directory}"
            )

        return Environment(
            loader=FileSystemLoader(paths),
            autoescape=select_autoescape(default_for_string=False),
            # Both disabled for Markdown — whitespace is controlled explicitly
            # in templates via {%- and -%} syntax.
            trim_blocks=False,
            lstrip_blocks=False,
        )

    def get_template_source(self) -> str:
        """Return the raw source of the main template."""
        template = self.env.get_template(self.config.templates.main)
        return template.render()

    def read_template_source(self) -> str:
        """Read the raw template file from disk."""
        template = self.env.get_template(self.config.templates.main)
        if hasattr(template, "filename") and template.filename:
            return Path(template.filename).read_text(encoding="utf-8")
        # Fallback: render with no context to get the source
        # (won't work for templates with required vars, but that's okay
        #  for analysis since we only scan for global names)
        try:
            return template.render()
        except Exception:
            return ""

    def render(self, context: dict) -> str:
        """Render the main template with the provided context."""
        template = self.env.get_template(self.config.templates.main)
        return template.render(**context)

    def validate(self, context: dict | None = None) -> None:
        """Validate that the main template can be loaded and parsed.

        Args:
            context: Optional template context. If provided, the template
                will be rendered with this context to catch undefined variable
                references.
        """
        template = self.env.get_template(self.config.templates.main)
        if context is not None:
            template.render(**context)
        else:
            # Syntax-only validation
            template.render()
