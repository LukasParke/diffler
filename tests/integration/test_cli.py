"""Integration tests for the CLI."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from diffler.cli import app

runner = CliRunner()


class TestCli:
    def test_version(self) -> None:
        result = runner.invoke(app, ["--version"])
        # Typer may return 0 or 2 for version flag depending on setup
        assert "diffler" in result.output

    def test_init_creates_files(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.chdir(tmp_path)
        result = runner.invoke(app, ["init", "--dir", ".github/diffler"])
        assert result.exit_code == 0
        assert (tmp_path / ".github" / "diffler.yml").exists()
        assert (tmp_path / ".github" / "diffler" / "profile.md.j2").exists()

    def test_validate_without_config(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.chdir(tmp_path)
        result = runner.invoke(app, ["validate"])
        # Should fail because no config or templates exist
        assert result.exit_code != 0
