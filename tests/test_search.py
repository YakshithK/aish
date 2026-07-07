from __future__ import annotations

from pathlib import Path

import agentshell.commands.search as search_command
from agentshell.commands.search import run


def test_python_search_groups_matches_and_ignores_dirs(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(search_command.shutil, "which", lambda name: None)
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "auth.py").write_text("login()\nlogout()\nlogin()\n", encoding="utf-8")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "ignored.js").write_text("login\n", encoding="utf-8")

    result = run("login", str(tmp_path))

    assert result.exit_code == 0
    assert "query=login matches=2 files=1 backend=python" in result.stdout
    assert "src/auth.py count=2 lines=1,3" in result.stdout
    assert "ignored.js" not in result.stdout


def test_no_matches_returns_grep_style_one(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(search_command.shutil, "which", lambda name: None)
    (tmp_path / "README.md").write_text("hello\n", encoding="utf-8")

    result = run("missing", str(tmp_path))

    assert result.exit_code == 1
    assert "matches=0" in result.stdout
