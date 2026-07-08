from __future__ import annotations

from agentshell.agent_rules import CURSOR_INSTRUCTIONS, SKILL_INSTRUCTIONS
from agentshell.output import AishError, CommandResult, EXIT_USAGE


SKILL_HOSTS = ("claude", "codex", "cursor", "opencode", "generic")


def print_skill(host: str) -> CommandResult:
    if host in {"claude", "codex", "opencode", "generic"}:
        return CommandResult(SKILL_INSTRUCTIONS)
    if host == "cursor":
        return CommandResult(CURSOR_INSTRUCTIONS)
    raise AishError(f"error=unknown_host host={host}", EXIT_USAGE)

