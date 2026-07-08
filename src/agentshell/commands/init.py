from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from agentshell.agent_rules import AGENT_INSTRUCTIONS, CURSOR_INSTRUCTIONS
from agentshell.output import CommandResult, join_lines


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
