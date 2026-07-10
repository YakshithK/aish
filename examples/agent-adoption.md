# Agent Adoption Matrix

`aish init --yes` installs missing global routing for every supported host and
does not write repo-local files in that run. Installation paths were verified
with an isolated fake home.

| Host | First-run command | Installed path | Verified behavior |
|---|---|---|---|
| Claude Code | `aish init --yes` | `~/.claude/skills/agentshell/SKILL.md` | prefers compact `aish` inspection routes |
| Codex | `aish init --yes` | `~/.codex/skills/agentshell/SKILL.md` | skill package installed for Codex skill discovery |
| Cursor | `aish init --yes` | `~/.cursor/rules/agentshell.mdc` | always-applied routing rule installed |
| OpenCode | `aish init --yes` | `~/.config/opencode/skills/agentshell/SKILL.md` | prefers compact `aish` inspection routes |

Automated coverage verifies global-only init, repo-local create/skip/force-update,
fake-home isolation, doctor detection, and byte-for-byte agreement with
`aish skill print`.
