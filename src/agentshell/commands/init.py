from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

from agentshell.agent_rules import AGENT_INSTRUCTIONS, CURSOR_INSTRUCTIONS
from agentshell.output import CommandResult, join_lines
from agentshell.commands.install_agent import HOSTS, installs_for


@dataclass(frozen=True)
class RuleFile:
    path: Path
    content: str


def run(
    path: str = ".",
    force: bool = False,
    yes: bool = False,
    no_global: bool = False,
    home: Path | None = None,
) -> CommandResult:
    root = Path(path)
    root.mkdir(parents=True, exist_ok=True)

    files = [
        RuleFile(root / "AGENTS.md", AGENT_INSTRUCTIONS),
        RuleFile(root / "CLAUDE.md", AGENT_INSTRUCTIONS),
        RuleFile(root / ".cursor" / "rules" / "agentshell.mdc", CURSOR_INSTRUCTIONS),
    ]

    created = 0
    updated = 0
    skipped = 0
    lines = []
    for rule_file in files:
        existed = rule_file.path.exists()
        if existed and not force:
            skipped += 1
            lines.append(f"skip {rule_file.path}")
            continue
        rule_file.path.parent.mkdir(parents=True, exist_ok=True)
        rule_file.path.write_text(rule_file.content, encoding="utf-8")
        if existed:
            updated += 1
            lines.append(f"update {rule_file.path}")
        else:
            created += 1
            lines.append(f"create {rule_file.path}")

    summary = f"agent_rules=installed created={created} updated={updated} skipped={skipped}"
    if skipped:
        lines.append("suggestion=run \"aish init --force\" to refresh existing files")
    else:
        lines.append("suggestion=run \"aish doctor\"")
    lines.extend(_global_routing_lines(yes=yes, no_global=no_global, home=home))
    return CommandResult(join_lines([summary, *lines]))


def _global_routing_lines(yes: bool = False, no_global: bool = False, home: Path | None = None) -> list[str]:
    missing = [host for host in HOSTS if not installs_for(host, home=home)[0].path.exists()]
    if not missing:
        return ["global_agent_routing=ok missing=0"]
    if no_global:
        return [
            "global_agent_routing=skipped",
            "missing_global_hosts=" + ",".join(missing),
            "note=repo_rules_installed_global_routing_skipped",
        ]
    if yes or _confirm_global_install(missing):
        return _install_missing_global(missing, home=home)
    return [
        "global_agent_routing=missing",
        "missing_global_hosts=" + ",".join(missing),
        "suggestion=run \"aish init --yes\" to install global agent routing",
    ]


def _confirm_global_install(missing: list[str]) -> bool:
    if not sys.stdin.isatty():
        return False
    answer = input(
        "Global AgentShell routing is not installed for "
        + ", ".join(missing)
        + ". Install it now? [Y/n] "
    ).strip().lower()
    return answer in ("", "y", "yes")


def _install_missing_global(missing: list[str], home: Path | None = None) -> list[str]:
    created = 0
    updated = 0
    skipped = 0
    lines: list[str] = []
    for host in missing:
        install = installs_for(host, home=home)[0]
        existed = install.path.exists()
        if existed:
            skipped += 1
            lines.append(f"skip global host={host} path={install.path}")
            continue
        install.path.parent.mkdir(parents=True, exist_ok=True)
        install.path.write_text(install.content, encoding="utf-8")
        created += 1
        lines.append(f"create global host={host} path={install.path}")
    return [
        f"global_agent_routing=installed created={created} updated={updated} skipped={skipped}",
        *lines,
        "suggestion=run \"aish doctor --agents\"",
    ]
