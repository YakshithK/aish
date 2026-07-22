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
aish docker compose logs api
aish curl http://localhost:3000/users
aish run --timeout 10 -- tree
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
- `aish <executable> [args...]` for any other non-interactive command

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
global_agent_routing=installed created=5 updated=0 skipped=0
create global host=claude path=/home/me/.claude/CLAUDE.md
create global host=claude path=/home/me/.claude/settings.json
create global host=codex path=/home/me/.codex/skills/agentshell/SKILL.md
create global host=cursor path=/home/me/.cursor/rules/agentshell.mdc
create global host=opencode path=/home/me/.config/opencode/skills/agentshell/SKILL.md
suggestion=run "aish doctor --agents"
```

For Claude Code specifically, global routing is not a skill you invoke — it's
an always-on rule appended to `~/.claude/CLAUDE.md` (merged in, existing
content is preserved), plus a `PreToolUse` hook registered in
`~/.claude/settings.json` that automatically rewrites a narrow set of raw
commands (`git status`, `git diff`, `cat <file>`, `find .`, `ls -R`,
`grep -R`, and recognized test/build invocations) to their `aish` equivalent
before they run. Ambiguous or compound commands (pipes, chaining, multiple
files, unrecognized flags) are left untouched rather than guessed at.

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
~/.claude/CLAUDE.md        (appended rule) + ~/.claude/settings.json (PreToolUse hook)
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
| other commands | `aish <executable> [args...]` | raw unbounded terminal output |
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

Use `--agents` to include global skill/rule installs (`partial` means only one
of the claude host's two installs — CLAUDE.md rule or PreToolUse hook — is
present):

```text
global_claude_skill=missing path=/home/me/.claude/CLAUDE.md
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

### Arbitrary commands and `aish run`

Any first token that is not a native AgentShell command is executed as an
external command and summarized with a test, build, logs, HTTP, or generic
parser:

```bash
aish npm install
aish cargo test
aish docker compose logs api
aish curl http://localhost:3000/users
```

Native AgentShell names always win. Use the explicit escape hatch when an
external executable has the same name:

```bash
aish tree                         # AgentShell's native tree command
aish run tree                     # external executable named tree
aish run --timeout 10 command     # timeout must be between 0.1 and 3600 seconds
```

`--` is optional for `aish run` (`aish run -- tree` also works) — it's required
only when the command's own first token starts with `-` and isn't `--timeout`,
since that's otherwise ambiguous with `run`'s own flags. Tokens after the
command are passed as the exact child argument list: AgentShell adds no shell
parsing, interpolation, globbing, redirects, or pipes. Arbitrary commands are
non-interactive, receive EOF on stdin, default to a 30-second timeout, and
preserve their exit code. A typo such as `aish tre` is therefore attempted as
an external command and normally exits 127 with `command_not_found`. When that
happens and the typo is close to one of AgentShell's own subcommands, a
`hint=did you mean "aish <command>"?` line is added — but only on
`command_not_found`. If the typo happens to match a real binary on `PATH`
(`aish stat` finding coreutils' `stat`, say, instead of `aish status`), that
binary runs and its own error is shown with no hint, since AgentShell can't
tell a deliberate external command from a fat-fingered subcommand once
something actually executed.

For curl, AgentShell never injects flags. It reports an HTTP status and headers
only when curl itself emitted them; otherwise the summary says
`http_status=?` while retaining bounded body or error evidence.

Log commands are summarized as complete events rather than unrelated lines.
AgentShell keeps stack-trace continuations attached, removes terminal control
sequences, groups repetitions across container replicas, and attributes each
group to its contributing services:

```text
status=failed exit=1 family=logs command="docker compose logs api"
raw_lines=84 compact_lines=14 services=api-1,api-2 errors=20 warnings=2
ERROR count=20 services=api-1,api-2
  2026-07-10T12:00:00Z api-1 | Error: database unavailable
      at connect (db.js:10:2)
WARN count=2 services=api-1
  2026-07-10T12:00:03Z api-1 | WARN retry scheduled
accounted_lines=84 emitted_lines=3 collapsed_lines=57 routine_omitted_lines=24 severity_omitted_lines=0 noise_lines=0 blank_lines=0 truncation_lines=0
overflow_groups=0 overflow_events=0 overflow_lines=0 overflow_errors=0 overflow_warnings=0
omitted=collapsed_repetitions,routine,noise,blank,overflow,full_output
truncated=false
```

`errors` and `warnings` count events including repetitions, while `count` is
the size of the displayed duplicate group. Evidence is ordered by errors,
warnings, repeated routine events, then a recent routine tail. The accounting
fields explain where every captured source line went. Unique-group tracking and
rendered evidence are bounded; overflow and capture truncation are always
reported instead of being silently discarded.

### `aish test -- <command>`

Runs the command after `--`, preserves the child exit code, and summarizes failures.
The `--` is optional (`aish test npm test` also works) — it's required only when
the command's own first token starts with `-`. Prefer including it: PowerShell's
`$args` binding silently drops a bare, unquoted `--` before it reaches `aish`, so
if you type it and it's not doing anything, quote it instead (`aish test '--' npm test`).

```text
status=failed exit=1 passed=? failed=2 command="python -m pytest"
FAIL tests/test_auth.py::test_empty_password AssertionError: expected 400
omitted=passing_tests,progress,full_stack_traces
parser=pytest
truncated=false
```

Known parsers include pytest, unittest, Jest/Vitest-style JavaScript output, Cargo, Go, and Node's own `node --test` runner. Unknown runners fall back to a bounded useful tail with `parser=generic`; in that case `passed`/`failed` report `?` rather than a guessed number.

A zero exit code is not blindly trusted: if the captured output itself contains
failure markers (e.g. a CI wrapper that swallows the real exit code), `status`
reports `passed_with_failures_in_output` instead of `passed`, with the same
`FAIL` evidence lines and a non-zero exit code. Treat any `status` other than
exactly `passed` as a failure.

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

Like `aish test`, a zero exit code with error/fatal/traceback text in the
captured output reports `status=passed_with_errors_in_output` (non-zero exit)
rather than `passed`.

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

`aish view`, `aish tree`, and `aish search` read local files under the requested
path. Observed commands execute exact argument arrays with shell processing
disabled and stdin ignored. Captured stdout, stderr, and interleaved evidence
are independently bounded; timed-out process trees are terminated. AgentShell
does not collect telemetry.

On Windows, commands routed through a `.cmd`/`.bat` shim (npm, pnpm, yarn, and
similar) are run through `cmd.exe` with every argument escaped. An argument
containing `"`, `<`, `>`, `&`, or `|` cannot be safely escaped for a batch-file
shim and is rejected with `error=unsupported_cmd_argument` rather than risking
misinterpretation by the shell. An invalid working directory is reported
distinctly as `error=invalid_cwd` rather than being misdiagnosed as a missing
command.

On POSIX, AgentShell also forwards catchable termination signals to the active
child process group. On Windows, interactive Ctrl-C is handled when Node receives
the console signal, but external parent-process termination such as
`child.kill('SIGINT')`, `taskkill /PID`, or forced process termination is not
catchable by JavaScript signal handlers; child cleanup in those cases depends on
the caller killing the process tree.
