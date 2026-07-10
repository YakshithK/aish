# Agent Adoption Matrix

The packaged static rules use the same routing contract for every supported
host. Installation paths were verified with an isolated fake home.

| Host | Command | Installed path | Verified behavior |
|---|---|---|---|
| Claude Code | `aish install-agent claude` | `~/.claude/skills/agentshell/SKILL.md` | prefers compact `aish` inspection routes |
| Codex | `aish install-agent codex` | `~/.codex/skills/agentshell/SKILL.md` | prefers compact `aish` inspection routes |
| Cursor | `aish install-agent cursor` | `~/.cursor/rules/agentshell.mdc` | always-applied routing rule installed |
| OpenCode | `aish install-agent opencode` | `~/.config/opencode/skills/agentshell/SKILL.md` | prefers compact `aish` inspection routes |

Automated coverage verifies create, skip, force-update, fake-home isolation,
doctor detection, and byte-for-byte agreement with `aish skill print`.
