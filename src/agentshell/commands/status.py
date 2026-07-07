from __future__ import annotations

from pathlib import Path

from agentshell.output import CommandResult, EXIT_RUNTIME, join_lines
from agentshell.subprocesses import run_command


def run(path: str = ".") -> CommandResult:
    root = Path(path)
    inside = run_command(["git", "-C", str(root), "rev-parse", "--is-inside-work-tree"])
    if inside.exit_code != 0:
        return CommandResult("error=not_git_repo\n", exit_code=EXIT_RUNTIME)

    branch_result = run_command(["git", "-C", str(root), "branch", "--show-current"])
    branch = branch_result.stdout.strip() or "detached"
    status = run_command(["git", "-C", str(root), "status", "--porcelain"])
    if status.exit_code != 0:
        return CommandResult("error=git_status_failed\n", status.stderr, EXIT_RUNTIME)

    entries = [_parse_line(line) for line in status.stdout.splitlines() if line]
    staged = sum(1 for x, _y, _path in entries if x not in (" ", "?"))
    unstaged = sum(1 for _x, y, _path in entries if y not in (" ", "?"))
    untracked = sum(1 for x, y, _path in entries if x == "?" and y == "?")
    changed = len(entries)

    lines = [
        f"branch={branch} changed={changed} staged={staged} unstaged={unstaged} untracked={untracked}",
    ]
    lines.extend(f"{x}{y} {name}" for x, y, name in entries[:40])
    if len(entries) > 40:
        lines.append(f"omitted={len(entries) - 40}")
    return CommandResult(join_lines(lines))


def _parse_line(line: str) -> tuple[str, str, str]:
    x = line[0] if len(line) > 0 else " "
    y = line[1] if len(line) > 1 else " "
    name = line[3:] if len(line) > 3 else ""
    if " -> " in name:
        name = name.split(" -> ", 1)[1]
    if name.startswith('"') and name.endswith('"'):
        name = name[1:-1]
    return x, y, name
