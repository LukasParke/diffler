"""Base class for Diffler plugins."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from jinja2 import Environment

    from diffler.config import DifflerConfig


class DifflerPlugin(ABC):
    """Abstract base class for Diffler plugins."""

    name: str = ""
    version: str = "0.0.0"

    @abstractmethod
    def register(self, renderer: Environment, config: DifflerConfig) -> None:
        """Register custom helpers, filters, or globals with the Jinja2 environment.

        Args:
            renderer: The Jinja2 Environment instance.
            config: The resolved Diffler configuration.
        """
