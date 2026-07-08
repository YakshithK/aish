from __future__ import annotations

import subprocess
from pathlib import Path

import agentshell.commands.doctor as doctor_command
from agentshell.commands.init import run as init
from agentshell.commands.inspect import run
from agentshell.subprocesses import RunResult


def test_inspect_recommends_init_when_rules_missing(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / "pyproject.toml").write_text("[project]\nname='sample'\n", encoding="utf-8")
    monkeypatch.setattr(doctor_command.shutil, "which", lambda name: "/usr/bin/rg")
    monkeypatch.setattr(
        doctor_command,
        "run_command",
        lambda cmd: RunResult(cmd, "true\n", "", 0),
    )

    result = run(str(tmp_path))

    assert "inspect=ok" in result.stdout
    assert "project: project=python" in result.stdout
    assert "rules: agent_rules=missing present=0 missing=3" in result.stdout
    assert "next: aish init" in result.stdout


def test_inspect_recommends_view_after_init(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / "pyproject.toml").write_text("[project]\nname='sample'\n", encoding="utf-8")
    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    init(str(tmp_path))
    monkeypatch.setattr(doctor_command.shutil, "which", lambda name: "/usr/bin/rg")
    monkeypatch.setattr(
        doctor_command,
        "run_command",
        lambda cmd: RunResult(cmd, "true\n", "", 0),
    )

    result = run(str(tmp_path))

    assert "rules: agent_rules=ok present=3 missing=0" in result.stdout
    assert "next: aish view <important-file>" in result.stdout
