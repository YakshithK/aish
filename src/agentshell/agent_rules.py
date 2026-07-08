from __future__ import annotations


ROUTING_TABLE = """| Need | Prefer | Avoid |
|---|---|---|
| inspect project structure | `aish tree` | `tree`, `find .`, `ls -R` |
| read a file | `aish view <file>` | `cat <file>` |
| read exact lines | `aish view <file>:<start>-<end>` | dumping whole files |
| search code | `aish search "<query>"` | raw `grep -R`, huge `rg` output |
| git state | `aish status` | verbose `git status` |
| tests | `aish test -- <command>` | raw noisy test logs |"""


AGENT_INSTRUCTIONS = f"""# AgentShell Instructions

For repository inspection, prefer AgentShell commands before raw shell commands.

Do not use `cat` on source files unless `aish view` is insufficient.
Do not use raw `tree`, `find .`, or `ls -R` unless `aish tree` is insufficient.
Do not dump large search results; use `aish search` first.
Do not dump large test logs; use `aish test -- <command>`.

## Routing

{ROUTING_TABLE}

Principle: summary first, details only when needed.

Preserve exact paths, line numbers, commands, exit codes, and error names from
`aish` output. If an `aish` command omits detail, ask for a narrower range or
query rather than dumping raw output.
"""


CURSOR_INSTRUCTIONS = f"""---
description: Prefer AgentShell compact terminal observations
globs:
  - "**/*"
alwaysApply: true
---

# AgentShell

For repository inspection, prefer AgentShell commands before raw shell commands.

{ROUTING_TABLE}

Principle: summary first, details only when needed.
"""


SKILL_INSTRUCTIONS = """---
name: agentshell
description: Use AgentShell when inspecting, debugging, reviewing, or modifying a codebase so terminal observations stay compact and exact.
---

# AgentShell

Use this skill when inspecting, debugging, reviewing, or modifying a codebase.

Prefer compact AgentShell commands:

- `aish tree` for project structure
- `aish view <file>` for file outline
- `aish view <file>:<start>-<end>` for exact lines
- `aish search "<query>"` for code search
- `aish status` for git status
- `aish test -- <command>` for summarized test output

Avoid raw commands that dump large human-oriented output:

- `cat`
- `tree`
- `find .`
- `grep -R`
- verbose test logs

Principle: summary first, exact details only when needed.

Preserve exact paths, line numbers, commands, exit codes, and error names from
`aish` output. If an `aish` command omits detail, ask for a narrower range or
query rather than dumping raw output.
"""

