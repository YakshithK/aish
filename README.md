# AgentShell

AgentShell is a token-optimized shell toolkit for AI coding agents.

Terminals were designed for humans. Coding agents now run `tree`, `cat`, `grep`, `git status`, and test commands constantly, then spend context on banners, progress bars, passing-test noise, giant file dumps, and repeated stack frames.

`aish` wraps common commands into compact observations built for agents:

```bash
aish init
aish doctor
aish tree
aish view README.md
aish view src/auth.py:1-80
aish search login
aish status
aish test -- python -m pytest
```

The principle is progressive disclosure: summary first, exact details only when needed.

## Agent workflow install

Install the CLI:

```bash
pipx install git+https://github.com/YakshithK/agentshell.git
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
- `aish test -- <command>` over raw test logs

Principle: summary first, details only when needed.

## Install

From a checkout:

```bash
python -m pip install -e .
```

From GitHub:

```bash
pipx install git+https://github.com/YakshithK/agentshell.git
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
| tests | `aish test -- <command>` | raw noisy test logs |
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

### `aish test -- <command>`

Runs the command after `--`, preserves the child exit code, and summarizes failures.

```text
status=failed exit=1 passed=? failed=? command="python -m pytest"
FAIL tests/test_auth.py::test_empty_password AssertionError: expected 400
omitted=passing_tests,progress,full_stack_traces
parser=pytest
truncated=false
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
