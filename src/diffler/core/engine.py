"""Main orchestration engine."""

from __future__ import annotations

import logging
from pathlib import Path

from diffler.config import DifflerConfig
from diffler.core.context import ContextBuilder
from diffler.core.git import README_PATH, commit_and_push, has_changes
from diffler.core.renderer import Renderer

logger = logging.getLogger(__name__)


class Engine:
    """Orchestrates loading, rendering, validation, and committing."""

    def __init__(self, config: DifflerConfig, renderer: Renderer) -> None:
        self.config = config
        self.renderer = renderer
        self.context_builder = ContextBuilder(config)

    def render(self) -> str:
        """Render the profile README."""
        template_source = self.renderer.read_template_source()
        context = self.context_builder.build(template_source)
        return self.renderer.render(context)

    def validate(self) -> None:
        """Validate templates and configuration."""
        template_source = self.renderer.read_template_source()
        context = self.context_builder.build(template_source)
        self.renderer.validate(context)
        # Future: validate config schema, check GitHub token scopes, etc.

    def update(
        self,
        *,
        dry_run: bool = False,
        message: str = "🤖 Auto-update profile README",
    ) -> None:
        """Render and optionally commit the profile README."""
        rendered = self.render()

        if dry_run:
            logger.info("Dry run — output:\n%s", rendered)
            return

        current = ""
        if README_PATH.exists():
            current = README_PATH.read_text(encoding="utf-8")

        if rendered == current:
            logger.info("No changes detected; skipping commit.")
            return

        README_PATH.write_text(rendered, encoding="utf-8")
        logger.info("README.md updated locally.")

        if has_changes(README_PATH):
            commit_and_push(message, README_PATH)
        else:
            logger.info("No git changes detected; skipping commit.")
