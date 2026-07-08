# AgentShell

AgentShell is a token-optimized shell toolkit for AI coding agents.

Terminals were designed for humans. Coding agents now run `tree`, `cat`, `grep`, `git status`, and test commands constantly, then spend context on banners, progress bars, passing-test noise, giant file dumps, and repeated stack frames.

`aish` wraps common commands into compact observations built for agents:

```bash
aish init
aish doctor
aish doctor --agents
aish inspect
aish install-agent claude
aish skill print generic
aish tree
aish view README.md
aish view src/auth.py:1-80
aish search login
aish status
aish diff
aish diff src/auth.py
aish test -- python -m pytest
aish build -- npm install
```

The principle is progressive disclosure: summary first, exact details only when needed.

## Agent workflow install

Install the CLI:

```bash
pipx install git+https://github.com/YakshithK/aish.git
```

Then install repo-local agent rules:

```bash
aish init
aish doctor
```

This writes instructions for coding agents so they prefer:

- `aish tree` over `tree`, `find .`, or `ls -R`
- `aish view` over `cat`
- `aish search` over noisy grep output
- `aish status` over verbose `git status`
- `aish diff` over raw patch dumps
- `aish test -- <command>` over raw test logs
- `aish build -- <command>` over raw build or install logs

Principle: summary first, details only when needed.

## Install

From a checkout:

```bash
python -m pip install -e .
```

From GitHub:

```bash
pipx install git+https://github.com/YakshithK/aish.git
```

Then install agent instructions in the repo:

```bash
aish init
aish doctor
```

## Commands

### `aish init`

Writes repo-local instruction files so agents naturally prefer AgentShell:

```text
agent_rules=installed created=3 updated=0 skipped=0
create AGENTS.md
create CLAUDE.md
create .cursor/rules/agentshell.mdc
suggestion=run "aish doctor"
```

Files created:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/agentshell.mdc`

Existing files are skipped by default. Use `aish init --force` to refresh them.

Generated instructions include a routing table:

```md
| Need | Prefer | Avoid |
|---|---|---|
| inspect project structure | `aish tree` | `tree`, `find .`, `ls -R` |
| read a file | `aish view <file>` | `cat <file>` |
| read exact lines | `aish view <file>:<start>-<end>` | dumping whole files |
| search code | `aish search "<query>"` | raw `grep -R`, huge `rg` output |
| git state | `aish status` | verbose `git status` |
| inspect changes | `aish diff` or `aish diff <file>` | raw `git diff`, `git show --patch` |
| tests | `aish test -- <command>` | raw noisy test logs |
| builds/install | `aish build -- <command>` | raw compiler, package install, or build logs |
```

### `aish doctor`

Checks whether AgentShell is installed and whether the repo has agent rules:

```text
aish=installed version=0.1.0
git_repo=true
rg=true
agent_rules=ok present=3 missing=0
suggestion=ready
```

Use `--agents` to include global skill/rule installs:

```text
global_claude_skill=missing path=/home/me/.claude/skills/agentshell/SKILL.md
global_codex_skill=missing path=/home/me/.codex/skills/agentshell/SKILL.md
global_cursor_skill=missing path=/home/me/.cursor/rules/agentshell.mdc
global_opencode_skill=missing path=/home/me/.config/opencode/skills/agentshell/SKILL.md
agent_suggestion=aish install-agent claude
```

### `aish install-agent`

Installs global AgentShell skills/rules for agent hosts:

```bash
aish install-agent claude
aish install-agent codex
aish install-agent cursor
aish install-agent opencode
aish install-agent all
```

Example output:

```text
agent_install=installed host=claude created=1 updated=0 skipped=0
create host=claude path=/home/me/.claude/skills/agentshell/SKILL.md
suggestion=run "aish doctor --agents"
```

Existing global files are skipped by default. Use `--force` to refresh them.

### `aish skill print`

Prints the AgentShell skill/rule content for manual installation or copy-paste:

```bash
aish skill print generic
aish skill print claude
aish skill print codex
aish skill print cursor
aish skill print opencode
```

### `aish inspect`

Runs the launch-demo inspection loop: setup state, git state, project map, and a next command.

```text
inspect=ok path=.
project: project=python files=24 dirs=6 important=pyproject.toml,src,tests
git: branch=main changed=0 staged=0 unstaged=0 untracked=0
rules: agent_rules=missing present=0 missing=3
next: aish init
```

### `aish tree`

Compact project structure. Ignores noisy directories such as `.git`, `node_modules`, `dist`, `build`, `target`, `.venv`, and `__pycache__`.

```text
project=python files=24 dirs=6 important=pyproject.toml,src,tests
root: pyproject.toml,src,tests,README.md
src: agentshell
tests: test_e2e.py,test_view.py
omitted: .git,__pycache__
```

### `aish view`

Safe replacement for `cat`. Short files print numbered lines. Long files print an outline and suggested ranges. Binary files are not dumped.

```text
file=src/auth.py lines=284 imports=5 exports=0 funcs=login:22-62,logout:70-110
use: aish view src/auth.py:22-62
omitted=full_file
```

Then ask for the exact range:

```bash
aish view src/auth.py:22-62
```

### `aish search`

Compact `rg`/grep summary. Uses ripgrep when available and falls back to Python search.

```text
query=login matches=12 files=3 backend=rg
src/auth.py count=5 lines=22,44,91
src/LoginPage.tsx count=4 lines=8,31
README.md count=3 lines=55
```

### `aish status`

Compact git status.

```text
branch=main changed=4 staged=1 unstaged=2 untracked=1
 M src/auth.py
A  tests/test_auth.py
?? notes.md
```

### `aish diff`

Summarizes git diffs before showing any patch hunks.

```text
diff=unstaged files=3 added=42 removed=18
M src/auth.py +22 -7
M tests/test_auth.py +18 -2
M README.md +2 -9
next: aish diff src/auth.py
```

Ask for one file when exact changed lines are needed:

```bash
aish diff src/auth.py
aish diff --staged
```

File-specific output is bounded:

```text
file=src/auth.py added=22 removed=7
@@ lines=44-71
+ if not password:
+     return error(400)
- return login_user(email, password)
omitted=context_lines,unchanged_hunks
```

### `aish test -- <command>`

Runs the command after `--`, preserves the child exit code, and summarizes failures.

```text
status=failed exit=1 passed=? failed=2 command="python -m pytest"
FAIL tests/test_auth.py::test_empty_password AssertionError: expected 400
omitted=passing_tests,progress,full_stack_traces
parser=pytest
truncated=false
```

Known parsers include pytest, unittest, Jest/Vitest-style JavaScript output, Cargo, and Go. Unknown runners fall back to a bounded useful tail with `parser=generic`.

### `aish build -- <command>`

Runs build, install, or compile commands and summarizes warnings/errors without dumping progress logs.

```text
status=failed exit=2 warnings=1 command="npm install"
ERROR npm ERR! code ERESOLVE
ERROR npm ERR! ERESOLVE unable to resolve dependency tree
omitted=progress,downloads,successful_steps
parser=build
truncated=false
```

Useful wrappers:

```bash
aish build -- npm install
aish build -- pnpm install
aish build -- pip install -e .
aish build -- cargo build
aish build -- docker build .
```

## Before/After

Raw terminal output is optimized for a human watching the run. AgentShell output is optimized for the next agent decision.

```bash
python -m pytest
# many lines of collection, progress, stack frames, and passing-test noise

aish test -- python -m pytest
# status=failed exit=1 ...
# FAIL tests/test_auth.py::test_empty_password ...
```

See [examples/before-after.md](examples/before-after.md) for a demo script.

## Launch Ask

If you use Claude Code, Codex, Cursor, Aider, or Windsurf: what terminal command wastes the most context for your agent?

## Safety

`aish view`, `aish tree`, and `aish search` read local files under the requested path. `aish test -- <command>` executes the exact command list after `--` without `shell=True`. AgentShell does not collect telemetry.
