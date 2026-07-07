from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from agentshell.output import CommandResult, join_lines


AGENT_INSTRUCTIONS = """# AgentShell Instructions

When inspecting this repo, prefer compact AgentShell observations over raw human-oriented terminal output.

- Use `aish tree` instead of `find`, `ls -R`, or `tree` for project structure.
- Use `aish view <file>` for short files and outlines.
- Use `aish view <file>:<start>-<end>` instead of `cat` or broad `sed` ranges when exact lines are needed.
- Use `aish search <query>` instead of raw `grep` or `rg` output.
- Use `aish status` instead of `git status`.
- Use `aish test -- <command>` instead of raw test output when running test suites.

Preserve exact paths, line numbers, commands, exit codes, and error names from `aish` output. If an `aish` command omits detail, ask for a narrower range or query rather than dumping raw output.
"""


CURSOR_INSTRUCTIONS = """---
description: Prefer AgentShell compact terminal observations
globs:
  - "**/*"
alwaysApply: true
---

# AgentShell

When inspecting this repo:

- Use `aish tree` instead of `find`, `ls -R`, or `tree`.
- Use `aish view <file>` or `aish view <file>:<start>-<end>` instead of `cat`.
- Use `aish search <query>` instead of raw `grep` or `rg`.
- Use `aish status` instead of `git status`.
- Use `aish test -- <command>` instead of raw test output.
"""


@dataclass(frozen=True)
class RuleFile:
    path: Path
    content: str


def run(path: str = ".", force: bool = False) -> CommandResult:
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
    return CommandResult(join_lines([summary, *lines]))
