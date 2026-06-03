"""Unit tests for built-in template helpers."""

from __future__ import annotations

import pytest

from diffler.helpers.badges import shield, social, github_stats_card
from diffler.helpers.layout import details, center, columns


class TestBadges:
    def test_shield_basic(self) -> None:
        result = shield("build", "passing", "green")
        assert result.startswith("![build](https://img.shields.io/badge/")
        assert "passing" in result
        assert "green" in result

    def test_shield_escapes(self) -> None:
        result = shield("my-label", "my-message")
        assert "my--label" in result or "my-label" in result

    def test_social(self) -> None:
        result = social("twitter", "https://twitter.com/octocat")
        assert "[Twitter](https://twitter.com/octocat)" == result

    def test_github_stats_card(self) -> None:
        result = github_stats_card("octocat")
        assert "octocat" in result
        assert "github-readme-stats" in result


class TestLayout:
    def test_details(self) -> None:
        result = details("Click me", "Hidden content")
        assert "<details>" in result
        assert "<summary>Click me</summary>" in result
        assert "Hidden content" in result
        assert "</details>" in result

    def test_center(self) -> None:
        result = center("Hello")
        assert '<div align="center">' in result
        assert "Hello" in result
        assert "</div>" in result

    def test_columns(self) -> None:
        result = columns(["A", "B", "C"], count=2)
        assert "<table>" in result
        assert "<td" in result
        assert "</table>" in result

    def test_columns_empty(self) -> None:
        assert columns([]) == ""
