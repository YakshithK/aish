from __future__ import annotations

import subprocess
from pathlib import Path

from agentshell.commands.diff import run


def test_diff_requires_git_repo(tmp_path: Path) -> None:
    result = run(str(tmp_path))

    assert result.exit_code == 3
    assert result.stdout == "error=not_git_repo\n"


def test_diff_summarizes_unstaged_changes(tmp_path: Path) -> None:
    _init_repo(tmp_path)
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "auth.py").write_text("def login():\n    return 200\n", encoding="utf-8")
    (tmp_path / "README.md").write_text("old\n", encoding="utf-8")
    _commit_all(tmp_path)
    (tmp_path / "src" / "auth.py").write_text("def login():\n    return 401\n\ndef logout():\n    return 204\n", encoding="utf-8")
    (tmp_path / "README.md").write_text("new\n", encoding="utf-8")

    result = run(str(tmp_path))

    assert result.exit_code == 0
    assert "diff=unstaged files=2" in result.stdout
    assert "M README.md +1 -1" in result.stdout
    assert "M src/auth.py +4 -1" in result.stdout
    assert "next: aish diff README.md" in result.stdout


def test_diff_file_outputs_bounded_hunks(tmp_path: Path) -> None:
    _init_repo(tmp_path)
    (tmp_path / "app.py").write_text("value = 1\n", encoding="utf-8")
    _commit_all(tmp_path)
    (tmp_path / "app.py").write_text("value = 2\nextra = True\n", encoding="utf-8")

    result = run(str(tmp_path), target="app.py")

    assert "file=app.py added=2 removed=1" in result.stdout
    assert "@@ lines=1-2" in result.stdout
    assert "-value = 1" in result.stdout
    assert "+value = 2" in result.stdout
    assert "omitted=context_lines,unchanged_hunks" in result.stdout


def test_diff_staged_changes(tmp_path: Path) -> None:
    _init_repo(tmp_path)
    (tmp_path / "app.py").write_text("value = 1\n", encoding="utf-8")
    _commit_all(tmp_path)
    (tmp_path / "app.py").write_text("value = 2\n", encoding="utf-8")
    subprocess.run(["git", "add", "app.py"], cwd=tmp_path, check=True)

    result = run(str(tmp_path), staged=True)

    assert "diff=staged files=1 added=1 removed=1" in result.stdout
    assert "M app.py +1 -1" in result.stdout


def _init_repo(path: Path) -> None:
    subprocess.run(["git", "init"], cwd=path, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=path, check=True)
    subprocess.run(["git", "config", "user.name", "Test User"], cwd=path, check=True)


def _commit_all(path: Path) -> None:
    subprocess.run(["git", "add", "."], cwd=path, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=path, check=True, capture_output=True)
