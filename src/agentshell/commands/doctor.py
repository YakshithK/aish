from __future__ import annotations

import shutil
from pathlib import Path

from agentshell import __version__
from agentshell.output import CommandResult, join_lines
from agentshell.subprocesses import run_command


RULE_PATHS = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules/agentshell.mdc",
]


def run(path: str = ".") -> CommandResult:
    root = Path(path)
    git_repo = _is_git_repo(root)
    rg = shutil.which("rg") is not None
    rules = [rule for rule in RULE_PATHS if (root / rule).exists()]
    missing = [rule for rule in RULE_PATHS if rule not in rules]

    lines = [
        f"aish=installed version={__version__}",
        f"git_repo={_bool(git_repo)}",
        f"rg={_bool(rg)}",
        f"agent_rules={_rules_state(rules)} present={len(rules)} missing={len(missing)}",
    ]
    if missing:
        lines.append('suggestion=run "aish init"')
        lines.append("missing=" + ",".join(missing))
    else:
        lines.append("suggestion=ready")
    return CommandResult(join_lines(lines))


def _is_git_repo(root: Path) -> bool:
    result = run_command(["git", "-C", str(root), "rev-parse", "--is-inside-work-tree"])
    return result.exit_code == 0 and result.stdout.strip() == "true"


def _rules_state(rules: list[str]) -> str:
    if len(rules) == len(RULE_PATHS):
        return "ok"
    if rules:
        return "partial"
    return "missing"


def _bool(value: bool) -> str:
    return "true" if value else "false"
