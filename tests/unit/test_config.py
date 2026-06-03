"""Unit tests for configuration loading."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from diffler.config import DifflerConfig


class TestConfig:
    def test_default_config(self) -> None:
        config = DifflerConfig()
        assert config.version == "1"
        assert config.github.api_url == "https://api.github.com"
        assert config.templates.main == "profile.md.j2"
        assert config.cache.enabled is True

    def test_from_file(self, tmp_path: Path) -> None:
        config_file = tmp_path / "diffler.yml"
        config_file.write_text(
            'version: "1"\n'
            "github:\n"
            '  username: "testuser"\n'
            "templates:\n"
            '  main: "custom.md.j2"\n',
            encoding="utf-8",
        )
        config = DifflerConfig.from_file(config_file)
        assert config.github.username == "testuser"
        assert config.templates.main == "custom.md.j2"

    def test_env_var_resolution(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("GITHUB_TOKEN", "ghp_secret")
        config = DifflerConfig()
        assert config.github.token == "ghp_secret"
