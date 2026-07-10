from __future__ import annotations


ROUTING_TABLE = """| Need | Prefer | Avoid |
|---|---|---|
| inspect project structure | `aish tree` | `tree`, `find .`, `ls -R` |
| read a file | `aish view <file>` | `cat <file>` |
| read exact lines | `aish view <file>:<start>-<end>` | dumping whole files |
| search code | `aish search "<query>"` | raw `grep -R`, huge `rg` output |
| git state | `aish status` | verbose `git status` |
| inspect changes | `aish diff` or `aish diff <file>` | raw `git diff`, `git show --patch` |
| tests | `aish test -- <command>` | raw noisy test logs |
| builds/install | `aish build -- <command>` | raw compiler, package install, or build logs |"""


AGENT_INSTRUCTIONS = f"""# AgentShell Instructions

For repository inspection, prefer AgentShell commands before raw shell commands.

Do not use `cat` on source files unless `aish view` is insufficient.
Do not use raw `tree`, `find .`, or `ls -R` unless `aish tree` is insufficient.
Do not dump large search results; use `aish search` first.
Do not dump large test logs; use `aish test -- <command>`.
Do not dump large build or install logs; use `aish build -- <command>`.

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

This is an always-on Cursor rule for this workspace. Do not treat it as optional
style guidance.

## First Move

When the user asks Cursor to inspect, understand, debug, modify, or review this
repository, run `aish inspect` before raw shell exploration when `aish` is
available. If `aish inspect` is unavailable, start with the closest compact
AgentShell command: `aish tree`, `aish status`, or `aish search "<query>"`.

## Routing

Prefer AgentShell commands before raw shell commands. Before using raw `cat`,
`tree`, `find .`, `ls -R`, `grep -R`, raw `git diff`, raw test logs, or raw
build/install logs, try the matching `aish` command first.

{ROUTING_TABLE}

Principle: summary first, exact details only when needed.

Preserve exact paths, line numbers, commands, exit codes, and error names from
`aish` output. If an `aish` command omits detail, ask for a narrower range such
as `aish view <file>:<start>-<end>` or `aish diff <file>` instead of dumping raw
output.
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
- `aish diff` or `aish diff <file>` for compact code changes
- `aish test -- <command>` for summarized test output
- `aish build -- <command>` for summarized build or install output

Avoid raw commands that dump large human-oriented output:

- `cat`
- `tree`
- `find .`
- `grep -R`
- raw `git diff`
- verbose test logs
- raw build or package install logs

Principle: summary first, exact details only when needed.

Preserve exact paths, line numbers, commands, exit codes, and error names from
`aish` output. If an `aish` command omits detail, ask for a narrower range or
query rather than dumping raw output.
"""
