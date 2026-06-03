"""Git operations for committing profile README updates."""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

README_PATH = Path("README.md")


def has_changes(path: Path = README_PATH) -> bool:
    """Check if the README has uncommitted changes."""
    result = subprocess.run(
        ["git", "diff", "--quiet", str(path)],
        capture_output=True,
    )
    return result.returncode != 0


def commit_and_push(message: str, path: Path = README_PATH) -> None:
    """Stage, commit, and push the README update.

    Args:
        message: Git commit message.
        path: Path to the file to commit.

    Raises:
        RuntimeError: If any git command fails.
    """
    _run_git("add", str(path))
    _run_git("commit", "-m", message)
    _run_git("push")
    logger.info("Committed and pushed: %s", message)


def _run_git(*args: str) -> str:
    """Run a git command and return stdout."""
    cmd = ["git", *args]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"Git command failed: {' '.join(cmd)}\n"
            f"stderr: {result.stderr.strip()}"
        )
    return result.stdout.strip()
