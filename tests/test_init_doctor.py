from __future__ import annotations

from pathlib import Path

import agentshell.commands.doctor as doctor_command
from agentshell.commands.doctor import run as doctor
from agentshell.commands.init import run as init
from agentshell.global_routing import install_global
from agentshell.commands.skill import print_skill
from agentshell.subprocesses import RunResult


def test_init_writes_agent_instruction_files(tmp_path: Path) -> None:
    result = init(str(tmp_path), no_global=True)

    assert result.exit_code == 0
    assert "agent_rules=installed created=3 updated=0 skipped=0" in result.stdout
    assert "global_agent_routing=skipped" in result.stdout
    assert (tmp_path / "AGENTS.md").exists()
    assert (tmp_path / "CLAUDE.md").exists()
    assert (tmp_path / ".cursor" / "rules" / "agentshell.mdc").exists()
    agents = (tmp_path / "AGENTS.md").read_text(encoding="utf-8")
    assert "For repository inspection, prefer AgentShell commands" in agents
    assert "| inspect project structure | `aish tree` |" in agents
    assert "Principle: summary first, details only when needed." in agents


def test_init_skips_existing_files_without_force(tmp_path: Path) -> None:
    agents = tmp_path / "AGENTS.md"
    agents.write_text("custom\n", encoding="utf-8")

    result = init(str(tmp_path), no_global=True)

    assert "created=2 updated=0 skipped=1" in result.stdout
    assert agents.read_text(encoding="utf-8") == "custom\n"


def test_init_force_refreshes_existing_files(tmp_path: Path) -> None:
    agents = tmp_path / "AGENTS.md"
    agents.write_text("custom\n", encoding="utf-8")

    result = init(str(tmp_path), force=True, no_global=True)

    assert "created=2 updated=1 skipped=0" in result.stdout
    assert "AgentShell Instructions" in agents.read_text(encoding="utf-8")


def test_init_yes_installs_missing_global_routing(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    home = tmp_path / "home"

    result = init(str(repo), yes=True, home=home)

    assert "global_agent_routing=installed created=4 updated=0 skipped=0" in result.stdout
    assert (home / ".claude" / "skills" / "agentshell" / "SKILL.md").exists()
    assert (home / ".codex" / "skills" / "agentshell" / "SKILL.md").exists()
    assert (home / ".cursor" / "rules" / "agentshell.mdc").exists()
    assert (home / ".config" / "opencode" / "skills" / "agentshell" / "SKILL.md").exists()


def test_init_does_not_prompt_or_install_global_routing_without_yes(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    home = tmp_path / "home"

    result = init(str(repo), home=home)

    assert "global_agent_routing=missing" in result.stdout
    assert "missing_global_hosts=claude,codex,cursor,opencode" in result.stdout
    assert 'suggestion=run "aish init --yes" to install global agent routing' in result.stdout
    assert not (home / ".codex" / "skills" / "agentshell" / "SKILL.md").exists()


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
    init(str(tmp_path), no_global=True)
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


def test_global_routing_writes_global_skill_files(tmp_path: Path) -> None:
    result = install_global("all", home=tmp_path)

    assert "global_agent_routing=installed host=all created=4 updated=0 skipped=0" in result.stdout
    assert (tmp_path / ".claude" / "skills" / "agentshell" / "SKILL.md").exists()
    assert (tmp_path / ".codex" / "skills" / "agentshell" / "SKILL.md").exists()
    assert (tmp_path / ".cursor" / "rules" / "agentshell.mdc").exists()
    assert (tmp_path / ".config" / "opencode" / "skills" / "agentshell" / "SKILL.md").exists()


def test_global_routing_skips_existing_without_force(tmp_path: Path) -> None:
    first = install_global("claude", home=tmp_path)
    second = install_global("claude", home=tmp_path)

    assert "created=1 updated=0 skipped=0" in first.stdout
    assert "created=0 updated=0 skipped=1" in second.stdout


def test_doctor_agents_reports_global_skill_state(tmp_path: Path, monkeypatch) -> None:
    install_global("claude", home=tmp_path)
    monkeypatch.setattr(doctor_command.shutil, "which", lambda name: "/usr/bin/rg")
    monkeypatch.setattr(
        doctor_command,
        "run_command",
        lambda cmd: RunResult(cmd, "true\n", "", 0),
    )

    result = doctor(str(tmp_path), agents=True, home=tmp_path)

    assert "global_claude_skill=present" in result.stdout
    assert "global_codex_skill=missing" in result.stdout
    assert "agent_suggestion=aish init --yes" in result.stdout


def test_skill_print_returns_host_content() -> None:
    generic = print_skill("generic")
    cursor = print_skill("cursor")

    assert "name: agentshell" in generic.stdout
    assert "Use this skill when inspecting" in generic.stdout
    assert "alwaysApply: true" in cursor.stdout
