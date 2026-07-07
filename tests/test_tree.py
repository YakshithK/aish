from __future__ import annotations

from pathlib import Path

from agentshell.commands.tree import run


def test_tree_summarizes_project_and_ignores_noise(tmp_path: Path) -> None:
    (tmp_path / "package.json").write_text("{}", encoding="utf-8")
    (tmp_path / "README.md").write_text("hi", encoding="utf-8")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.ts").write_text("", encoding="utf-8")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "ignored.js").write_text("", encoding="utf-8")

    result = run(str(tmp_path))

    assert "project=node" in result.stdout
    assert "important=package.json,README.md,src" in result.stdout
    assert "root: package.json,README.md,src" in result.stdout
    assert "src: app.ts" in result.stdout
    assert "omitted: node_modules" in result.stdout


def test_tree_does_not_follow_symlinked_dirs(tmp_path: Path) -> None:
    real = tmp_path / "real"
    real.mkdir()
    (real / "secret.txt").write_text("secret", encoding="utf-8")
    (tmp_path / "linked").symlink_to(real, target_is_directory=True)

    result = run(str(tmp_path))

    assert "secret.txt" not in result.stdout
    assert "linked@" in result.stdout
