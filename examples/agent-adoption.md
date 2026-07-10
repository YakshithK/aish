# Agent Adoption Matrix

`aish init --yes` writes repo-local routing and installs missing global routing
for every supported host. Installation paths were verified with an isolated fake
home.

| Host | First-run command | Installed path | Verified behavior |
|---|---|---|---|
| Claude Code | `aish init --yes` | `~/.claude/skills/agentshell/SKILL.md` | prefers compact `aish` inspection routes |
| Codex | `aish init --yes` | `~/.codex/skills/agentshell/SKILL.md` | prefers compact `aish` inspection routes |
| Cursor | `aish init --yes` | `~/.cursor/rules/agentshell.mdc` | always-applied routing rule installed |
| OpenCode | `aish init --yes` | `~/.config/opencode/skills/agentshell/SKILL.md` | prefers compact `aish` inspection routes |

Automated coverage verifies repo-local create/skip/force-update, global routing
with fake-home isolation, doctor detection, and byte-for-byte agreement with
`aish skill print`.
