from __future__ import annotations

from pathlib import Path

from agentshell.commands.status import run


def test_not_git_repo_returns_runtime_error(tmp_path: Path) -> None:
    result = run(str(tmp_path))

    assert result.exit_code == 3
    assert result.stdout == "error=not_git_repo\n"


def test_git_status_counts_changes(tmp_path: Path) -> None:
    import subprocess

    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "Test User"], cwd=tmp_path, check=True)
    (tmp_path / "tracked.txt").write_text("one\n", encoding="utf-8")
    subprocess.run(["git", "add", "tracked.txt"], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=tmp_path, check=True, capture_output=True)
    (tmp_path / "tracked.txt").write_text("two\n", encoding="utf-8")
    (tmp_path / "new file.txt").write_text("new\n", encoding="utf-8")
    subprocess.run(["git", "add", "new file.txt"], cwd=tmp_path, check=True)

    result = run(str(tmp_path))

    assert result.exit_code == 0
    assert "changed=2 staged=1 unstaged=1 untracked=0" in result.stdout
    assert " M tracked.txt" in result.stdout
    assert "A  new file.txt" in result.stdout
