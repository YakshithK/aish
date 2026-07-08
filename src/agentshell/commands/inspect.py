from __future__ import annotations

from agentshell.commands import doctor, status, tree
from agentshell.output import CommandResult, join_lines


def run(path: str = ".") -> CommandResult:
    doctor_result = doctor.run(path)
    status_result = status.run(path)
    tree_result = tree.run(path)

    tree_summary = _first_line(tree_result.stdout, "project=unknown")
    status_summary = _first_line(status_result.stdout, "git=unknown")
    rules_summary = _find_line(doctor_result.stdout, "agent_rules=", "agent_rules=unknown")
    next_command = _next_command(rules_summary, status_summary, tree_summary)

    lines = [
        f"inspect=ok path={path}",
        f"project: {tree_summary}",
        f"git: {status_summary}",
        f"rules: {rules_summary}",
        f"next: {next_command}",
    ]
    return CommandResult(join_lines(lines), exit_code=max(doctor_result.exit_code, tree_result.exit_code))


def _first_line(output: str, fallback: str) -> str:
    for line in output.splitlines():
        if line.strip():
            return line
    return fallback


def _find_line(output: str, prefix: str, fallback: str) -> str:
    for line in output.splitlines():
        if line.startswith(prefix):
            return line
    return fallback


def _next_command(rules_summary: str, status_summary: str, tree_summary: str) -> str:
    if "agent_rules=missing" in rules_summary or "agent_rules=partial" in rules_summary:
        return "aish init"
    if "error=not_git_repo" in status_summary:
        return 'aish search "<query>"'
    if "important=-" not in tree_summary:
        return "aish view <important-file>"
    return 'aish search "<query>"'

