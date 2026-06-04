"""Configuration models and loading for Diffler."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_yaml import parse_yaml_raw_as

DEFAULT_CONFIG_PATH = Path(".github/diffler.yml")


def _load_dotenv(path: Path = Path(".env")) -> None:
    """Load environment variables from a .env file if present."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _resolve_env(value: Any) -> Any:
    """Resolve ${VAR} placeholders from environment variables."""
    if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
        env_var = value[2:-1]
        return os.environ.get(env_var, value)
    return value


class GitHubProfileConfig(BaseModel):
    """Per-profile GitHub authentication settings.

    Allows separate tokens per account, which is useful when aggregating
    stats across personal and work profiles where private org repos
    require different authentication scopes.
    """

    username: str
    token: str = Field(default="${GITHUB_TOKEN}")

    @model_validator(mode="after")
    def _resolve_env_vars(self) -> "GitHubProfileConfig":
        self.token = _resolve_env(self.token)
        self.username = _resolve_env(self.username)
        return self


class GitHubConfig(BaseModel):
    """GitHub authentication and user settings."""

    username: str | None = None
    usernames: list[str] = Field(default_factory=list)
    token: str = Field(default="${GITHUB_TOKEN}")
    profiles: list[GitHubProfileConfig] = Field(default_factory=list)
    api_url: str = "https://api.github.com"
    graphql_url: str = "https://api.github.com/graphql"
    include_orgs: bool = False
    large_repo_mode: bool = False

    @model_validator(mode="after")
    def _resolve_env_vars(self) -> "GitHubConfig":
        self.token = _resolve_env(self.token)
        if self.username is not None:
            self.username = _resolve_env(self.username)
        self.api_url = _resolve_env(self.api_url)
        self.graphql_url = _resolve_env(self.graphql_url)
        # Profiles resolve their own env vars via their own validator,
        # but we re-resolve here just in case they were constructed inline
        for profile in self.profiles:
            profile.token = _resolve_env(profile.token)
            profile.username = _resolve_env(profile.username)
        return self

    def get_usernames(self) -> list[str]:
        """Return all usernames to collect data for.

        If ``usernames`` is set, returns that list. Otherwise returns
        a singleton list with ``username`` (if set).
        """
        if self.usernames:
            return self.usernames
        if self.username:
            return [self.username]
        return []

    def get_profiles(self) -> list[GitHubProfileConfig]:
        """Return all profiles to collect data for.

        If ``profiles`` is explicitly configured, returns that list.
        Otherwise falls back to ``usernames`` / ``username`` paired
        with the global ``token``.
        """
        if self.profiles:
            return self.profiles
        usernames = self.get_usernames()
        if usernames:
            return [
                GitHubProfileConfig(username=u, token=self.token)
                for u in usernames
            ]
        return []


class TemplateConfig(BaseModel):
    """Template discovery and rendering settings."""

    main: str = "profile.md.j2"
    directory: Path = Path(".github/diffler")
    builtins: bool = True


class CacheConfig(BaseModel):
    """API response caching settings."""

    enabled: bool = True
    ttl: int = 3600
    directory: Path | None = None


class DifflerConfig(BaseModel):
    """Top-level Diffler configuration."""

    version: str = "1"
    github: GitHubConfig = Field(default_factory=GitHubConfig)
    templates: TemplateConfig = Field(default_factory=TemplateConfig)
    cache: CacheConfig = Field(default_factory=CacheConfig)
    helpers: dict[str, Any] = Field(default_factory=dict)
    plugins: list[str] = Field(default_factory=list)

    @classmethod
    def from_file(cls, path: Path) -> "DifflerConfig":
        """Load configuration from a YAML file."""
        _load_dotenv()
        raw = path.read_text(encoding="utf-8")
        return parse_yaml_raw_as(cls, raw)

    @classmethod
    def from_env(cls) -> "DifflerConfig":
        """Build configuration from environment variables."""
        _load_dotenv()
        config = cls()
        if username := os.environ.get("DIFFLER_GITHUB_USERNAME"):
            config.github.username = username
        if token := os.environ.get("GITHUB_TOKEN"):
            config.github.token = token
        if main := os.environ.get("DIFFLER_TEMPLATE_MAIN"):
            config.templates.main = main
        return config
