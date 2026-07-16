# Install Transcript

Captured July 15, 2026 from a disposable repository, installing the real
published package from the npm registry — not a local checkout, not
`pipx`/`uv`.

Setup: a scoped install prefix stands in for a global install so this doesn't
touch the machine's real global npm packages, plus a fresh `git init` repo.

```bash
mkdir -p prefix repo
cd repo && git init
```

## Install

```text
$ npm install --prefix ./prefix -g @yakshith/agentshell
added 1 package in 7s
```

On Windows, npm places global bins directly under the prefix root (not
`prefix/bin`); `aish` and `agentshell` both resolve once that directory is on
`PATH`.

## `aish --help`

```text
$ aish --help
usage: aish [-h] {tree,view,search,status,diff,inspect,init,doctor,skill,test,build,benchmark,run} ...

Compact terminal observations for AI coding agents.

commands:
  tree           show compact project structure
  view           safely view a file or line range
  search         search compactly
  status         show compact git status
  diff           summarize git diffs without dumping full patches
  inspect        summarize repo setup, git state, and project structure
  init           install agent instructions for this repo
  doctor         check AgentShell setup
  skill          print AgentShell skill/rule content
  test           run and summarize a test command
  build          run and summarize a build or install command
  benchmark      measure raw vs compact fixture output
  run            observe an external command, including native-name collisions
```

## `aish doctor --agents` (before init)

```text
$ aish doctor --agents
aish=installed version=0.1.0
git_repo=true
rg=false
agent_rules=missing present=0 missing=3
suggestion=run "aish init"
missing=AGENTS.md,CLAUDE.md,.cursor/rules/agentshell.mdc
global_claude_skill=missing path=~/.claude/skills/agentshell/SKILL.md
global_codex_skill=missing path=~/.codex/skills/agentshell/SKILL.md
global_cursor_skill=missing path=~/.cursor/rules/agentshell.mdc
global_opencode_skill=missing path=~/.config/opencode/skills/agentshell/SKILL.md
agent_suggestion=aish init --yes
```

## `aish init`

```text
$ aish init
agent_rules=installed created=3 updated=0 skipped=0
create AGENTS.md
create CLAUDE.md
create .cursor\rules\agentshell.mdc
suggestion=run "aish doctor"
global_agent_routing=missing
missing_global_hosts=claude,codex,cursor,opencode
suggestion=run "aish init --yes" to install global agent routing
```

Run non-interactively (no TTY), `aish init` writes only repo-local rules and
reports the global routing gap instead of prompting. This transcript
deliberately does not run `aish init --yes`, since that writes real files
under the current user's home directory (`~/.claude`, `~/.codex`,
`~/.cursor`, `~/.config/opencode`) — global-routing installation is covered
separately in `examples/agent-adoption.md`, which used an isolated fake home.

## `aish doctor --agents` (after init)

```text
$ aish doctor --agents
aish=installed version=0.1.0
git_repo=true
rg=false
agent_rules=ok present=3 missing=0
suggestion=ready
global_claude_skill=missing path=~/.claude/skills/agentshell/SKILL.md
global_codex_skill=missing path=~/.codex/skills/agentshell/SKILL.md
global_cursor_skill=missing path=~/.cursor/rules/agentshell.mdc
global_opencode_skill=missing path=~/.config/opencode/skills/agentshell/SKILL.md
agent_suggestion=aish init --yes
```

## `aish inspect`

```text
$ aish inspect
inspect=ok path=.
project: project=unknown files=3 dirs=2 important=-
git: branch=master changed=3 staged=0 unstaged=0 untracked=3
rules: agent_rules=ok present=3 missing=0
next: aish search "<query>"
```

## Notes

- `doctor` reports `version=0.1.0` even though the installed package is
  `@yakshith/agentshell@0.1.2` per the npm registry and this repo's
  `package.json` — the version string embedded in `doctor`'s output appears
  stale relative to the actual published version and is worth a follow-up fix.
- `rg=false` because ripgrep was not on `PATH` in this disposable prefix;
  `search` falls back to its built-in JS search in that case.
- `project=unknown` because the disposable repo has no `package.json`,
  `pyproject.toml`, `Cargo.toml`, or `go.mod` — expected for an empty repo.
