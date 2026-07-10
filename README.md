# AgentShell

AgentShell is a token-optimized shell toolkit for AI coding agents.

Terminals were designed for humans. Coding agents now run `tree`, `cat`, `grep`, `git status`, and test commands constantly, then spend context on banners, progress bars, passing-test noise, giant file dumps, and repeated stack frames.

`aish` wraps common commands into compact observations built for agents:

```bash
aish init
aish doctor
aish doctor --agents
aish inspect
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
aish benchmark
```

The principle is progressive disclosure: summary first, exact details only when needed.

## Agent workflow install

Install the CLI:

```bash
npm install -g @yakshith/agentshell
```

Or try it without installing globally:

```bash
npx @yakshith/agentshell --help
npx @yakshith/agentshell inspect
```

Then run init from a repo:

```bash
cd your-repo
aish init
aish doctor --agents
```

This checks whether global agent routing is installed before writing repo-local
instructions. If global routing is missing, interactive shells ask whether to
add it. Choosing yes installs the global routing and stops there. Run `aish init`
again in the repo after that if you also want repo-local files.

In non-interactive shells, use `aish init --yes` for the same global-only
first step.

The installed rules make coding agents prefer:

- `aish tree` over `tree`, `find .`, or `ls -R`
- `aish view` over `cat`
- `aish search` over noisy grep output
- `aish status` over verbose `git status`
- `aish diff` over raw patch dumps
- `aish test -- <command>` over raw test logs
- `aish build -- <command>` over raw build or install logs

Principle: summary first, details only when needed.

## Install

From npm (Node.js 20+):

```bash
npm install -g @yakshith/agentshell
```

From a checkout:

```bash
npm install -g .
```

The previous Python package remains available as a compatibility path for one
release while npm is the primary distribution.

Then initialize a repo:

```bash
cd your-repo
aish init
aish doctor --agents
```

## Commands

### `aish init`

Handles first-run global agent routing before repo-local instruction files.

If global routing is missing and you accept the prompt, or run
`aish init --yes`, AgentShell installs global routing and does not write repo
files in that run:

```text
global_agent_routing=installed created=4 updated=0 skipped=0
create global host=claude path=/home/me/.claude/skills/agentshell/SKILL.md
create global host=codex path=/home/me/.codex/skills/agentshell/SKILL.md
create global host=cursor path=/home/me/.cursor/rules/agentshell.mdc
create global host=opencode path=/home/me/.config/opencode/skills/agentshell/SKILL.md
suggestion=run "aish doctor --agents"
```

If global routing is already present, or you decline the prompt, `aish init`
writes repo-local files:

```text
agent_rules=installed created=3 updated=0 skipped=0
create AGENTS.md
create CLAUDE.md
create .cursor/rules/agentshell.mdc
suggestion=run "aish doctor"
global_agent_routing=missing
missing_global_hosts=claude,codex,cursor,opencode
suggestion=run "aish init --yes" to install global agent routing
```

Files created:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/agentshell.mdc`

Existing repo files are skipped by default. Use `aish init --force` to refresh
them.

Global routing is installed once per machine/agent host:

```text
~/.claude/skills/agentshell/SKILL.md
~/.codex/skills/agentshell/SKILL.md
~/.cursor/rules/agentshell.mdc
~/.config/opencode/skills/agentshell/SKILL.md
```

Useful init modes:

```bash
aish init              # if globals are missing, ask; yes installs globals only
aish init --yes        # install missing global routing only
aish init --no-global  # repo rules only
aish init --force      # refresh existing repo rules
```

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
agent_suggestion=aish init --yes
```

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

### `aish benchmark`

Runs deterministic bundled fixtures and reports raw versus compact output size
plus evidence preservation.

```text
AgentShell benchmark
cases=5 evidence=preserved

git_diff raw_lines=42 raw_chars=1258 compact_lines=10 compact_chars=287 shrink=77.2% evidence=preserved
preserved=files,hunks,additions,deletions,risk_markers
```

Use this for launch claims and regression checks. The benchmark is fixture
backed, so it does not depend on the current repo state or network.

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
