from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from agentshell.agent_rules import CURSOR_INSTRUCTIONS, SKILL_INSTRUCTIONS
from agentshell.output import AishError, CommandResult, EXIT_USAGE, join_lines


HOSTS = ("claude", "codex", "cursor", "opencode")


@dataclass(frozen=True)
class AgentInstall:
    host: str
    path: Path
    content: str


def installs_for(host: str, home: Path | None = None) -> list[AgentInstall]:
    if host == "all":
        installs: list[AgentInstall] = []
        for name in HOSTS:
            installs.extend(installs_for(name, home=home))
        return installs

    root = Path.home() if home is None else home
    if host == "claude":
        return [AgentInstall(host, root / ".claude" / "skills" / "agentshell" / "SKILL.md", SKILL_INSTRUCTIONS)]
    if host == "codex":
        return [AgentInstall(host, root / ".codex" / "skills" / "agentshell" / "SKILL.md", SKILL_INSTRUCTIONS)]
    if host == "cursor":
        return [AgentInstall(host, root / ".cursor" / "rules" / "agentshell.mdc", CURSOR_INSTRUCTIONS)]
    if host == "opencode":
        return [
            AgentInstall(
                host,
                root / ".config" / "opencode" / "skills" / "agentshell" / "SKILL.md",
                SKILL_INSTRUCTIONS,
            )
        ]
    raise AishError(f"error=unknown_host host={host}", EXIT_USAGE)


def run(host: str, force: bool = False, home: Path | None = None) -> CommandResult:
    installs = installs_for(host, home=home)
    created = 0
    updated = 0
    skipped = 0
    lines: list[str] = []

    for install in installs:
        existed = install.path.exists()
        if existed and not force:
            skipped += 1
            lines.append(f"skip host={install.host} path={install.path}")
            continue

        install.path.parent.mkdir(parents=True, exist_ok=True)
        install.path.write_text(install.content, encoding="utf-8")
        if existed:
            updated += 1
            lines.append(f"update host={install.host} path={install.path}")
        else:
            created += 1
            lines.append(f"create host={install.host} path={install.path}")

    summary = f"agent_install=installed host={host} created={created} updated={updated} skipped={skipped}"
    if skipped:
        lines.append(f"suggestion=run \"aish install-agent {host} --force\" to refresh existing files")
    else:
        lines.append('suggestion=run "aish doctor --agents"')
    return CommandResult(join_lines([summary, *lines]))

