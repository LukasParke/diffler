"""Unit tests for configuration loading."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from diffler.config import DifflerConfig, GitHubProfileConfig


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

    def test_profiles_override_usernames(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("GH_PERSONAL", "token_personal")
        monkeypatch.setenv("GH_WORK", "token_work")
        config = DifflerConfig(
            github={
                "profiles": [
                    {"username": "personal", "token": "${GH_PERSONAL}"},
                    {"username": "work", "token": "${GH_WORK}"},
                ]
            }
        )
        profiles = config.github.get_profiles()
        assert len(profiles) == 2
        assert profiles[0].username == "personal"
        assert profiles[0].token == "token_personal"
        assert profiles[1].username == "work"
        assert profiles[1].token == "token_work"

    def test_get_profiles_fallback_to_usernames(self) -> None:
        config = DifflerConfig(
            github={
                "usernames": ["alice", "bob"],
                "token": "global_token",
            }
        )
        profiles = config.github.get_profiles()
        assert len(profiles) == 2
        assert profiles[0].username == "alice"
        assert profiles[0].token == "global_token"
        assert profiles[1].username == "bob"
        assert profiles[1].token == "global_token"

    def test_get_profiles_fallback_to_single_username(self) -> None:
        config = DifflerConfig(
            github={
                "username": "alice",
                "token": "global_token",
            }
        )
        profiles = config.github.get_profiles()
        assert len(profiles) == 1
        assert profiles[0].username == "alice"
        assert profiles[0].token == "global_token"

    def test_get_profiles_empty(self) -> None:
        config = DifflerConfig(github={})
        assert config.github.get_profiles() == []
        assert config.github.get_usernames() == []

    def test_profile_config_from_file(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("GH_WORK", "work_secret")
        config_file = tmp_path / "diffler.yml"
        config_file.write_text(
            'version: "1"\n'
            "github:\n"
            "  profiles:\n"
            '    - username: "work"\n'
            '      token: "${GH_WORK}"\n',
            encoding="utf-8",
        )
        config = DifflerConfig.from_file(config_file)
        profiles = config.github.get_profiles()
        assert len(profiles) == 1
        assert profiles[0].username == "work"
        assert profiles[0].token == "work_secret"
