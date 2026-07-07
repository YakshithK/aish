from __future__ import annotations

from pathlib import Path

import agentshell.commands.doctor as doctor_command
from agentshell.commands.doctor import run as doctor
from agentshell.commands.init import run as init
from agentshell.subprocesses import RunResult


def test_init_writes_agent_instruction_files(tmp_path: Path) -> None:
    result = init(str(tmp_path))

    assert result.exit_code == 0
    assert "agent_rules=installed created=3 updated=0 skipped=0" in result.stdout
    assert (tmp_path / "AGENTS.md").exists()
    assert (tmp_path / "CLAUDE.md").exists()
    assert (tmp_path / ".cursor" / "rules" / "agentshell.mdc").exists()
    assert "use `aish tree`" in (tmp_path / "AGENTS.md").read_text(encoding="utf-8").lower()


def test_init_skips_existing_files_without_force(tmp_path: Path) -> None:
    agents = tmp_path / "AGENTS.md"
    agents.write_text("custom\n", encoding="utf-8")

    result = init(str(tmp_path))

    assert "created=2 updated=0 skipped=1" in result.stdout
    assert agents.read_text(encoding="utf-8") == "custom\n"


def test_init_force_refreshes_existing_files(tmp_path: Path) -> None:
    agents = tmp_path / "AGENTS.md"
    agents.write_text("custom\n", encoding="utf-8")

    result = init(str(tmp_path), force=True)

    assert "created=2 updated=1 skipped=0" in result.stdout
    assert "AgentShell Instructions" in agents.read_text(encoding="utf-8")


def test_doctor_reports_missing_rules(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(doctor_command.shutil, "which", lambda name: None)
    monkeypatch.setattr(
        doctor_command,
        "run_command",
        lambda cmd: RunResult(cmd, "", "", 128),
    )

    result = doctor(str(tmp_path))

    assert "aish=installed version=" in result.stdout
    assert "git_repo=false" in result.stdout
    assert "rg=false" in result.stdout
    assert "agent_rules=missing present=0 missing=3" in result.stdout
    assert 'suggestion=run "aish init"' in result.stdout


def test_doctor_reports_ready_after_init(tmp_path: Path, monkeypatch) -> None:
    init(str(tmp_path))
    monkeypatch.setattr(doctor_command.shutil, "which", lambda name: "/usr/bin/rg")
    monkeypatch.setattr(
        doctor_command,
        "run_command",
        lambda cmd: RunResult(cmd, "true\n", "", 0),
    )

    result = doctor(str(tmp_path))

    assert "git_repo=true" in result.stdout
    assert "rg=true" in result.stdout
    assert "agent_rules=ok present=3 missing=0" in result.stdout
    assert "suggestion=ready" in result.stdout
