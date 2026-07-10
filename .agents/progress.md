# AgentShell Progress Map

Updated: Thursday, July 9, 2026 after the Node/npm parity rewrite
Workspace: `/home/yakshith/aish`
Branch: `main`
Git state at capture: clean and synchronized with `origin/main`

## Current E2E State

AgentShell now has a zero-runtime-dependency Node.js implementation named
`agentshell`, exposed as both `aish` and `agentshell`. npm is the primary
distribution; the Python implementation remains as the parity oracle and
compatibility path for one release.

Node v0 parity, package verification, install smoke, and deterministic benchmark
proof are implemented. A post-rewrite parity audit restored exact CLI behavior,
bounded streaming, static rules, benchmark fixtures, and missing regression tests.

The project has moved from engineering mode to evidence mode. The next goal is
not another wrapper. The next goal is to prove that a new user can install it,
that their agent naturally uses it, and that the output reduction is measured
and credible.

## Implemented Surface

```text
aish tree
aish view
aish search
aish status
aish diff
aish inspect
aish init
aish doctor
aish install-agent
aish skill
aish test -- <command>
aish build -- <command>
```

This includes the original v0 plus:

- repo-local agent rules;
- global host installs for supported agents;
- compact diff summaries;
- multi-runner test failure summaries;
- compact build/install log summaries;
- an inspection workflow for demos and onboarding.

## Verified Working

Latest verified test run from this checkout:

```bash
UV_CACHE_DIR=/home/yakshith/aish/.uv-cache uv run pytest
```

Result:

```text
46 passed in 7.26s
```

CLI smoke also passed and exposes all command groups listed above.

Latest shipped commits at capture:

```text
db98a86 change github url from agentshell to aish
c018c6e feat: add compact build log summaries
1842d7d feat: recognize common test runner failures
e55c5c7 feat: add compact git diff summaries
2d23be9 feat: add agent inspection workflow
188cdfd feat: add global agent skill installs
ac54863 docs: sharpen agent workflow install
```

## Research State

`.agents/token-research.md` records the evidence base. The highest token-risk
command classes are:

1. Diffs and patches.
2. Test failures and verification logs.
3. Dependency install and build output.
4. File dumps and recursive enumeration.
5. Search output.
6. Runtime logs and service/container state.
7. HTTP/API/CLI integration output.

Classes 1-5 now have meaningful AgentShell coverage. Runtime logs are the next
research-driven wrapper, but they are intentionally frozen until launch proof
exists.

## What Is Now Implemented For Proof

`aish benchmark` exists and runs deterministic bundled fixtures for:

```text
git_diff
pytest_failure
build_log
tree
search
```

Current output:

```text
AgentShell benchmark
cases=5 evidence=preserved

git_diff raw_lines=42 raw_chars=1258 compact_lines=10 compact_chars=287 shrink=77.2% evidence=preserved
pytest_failure raw_lines=22 raw_chars=871 compact_lines=4 compact_chars=234 shrink=73.1% evidence=preserved
build_log raw_lines=19 raw_chars=683 compact_lines=7 compact_chars=269 shrink=60.6% evidence=preserved
tree raw_lines=20 raw_chars=327 compact_lines=5 compact_chars=201 shrink=38.5% evidence=preserved
search raw_lines=7 raw_chars=212 compact_lines=5 compact_chars=146 shrink=31.1% evidence=preserved
```

Verification after implementation:

```text
50 passed in 7.14s
uv build succeeded
```

## What Is Not Proven Yet

These are now the blockers:

- No clean install transcript saved from a disposable repo.
- No agent adoption table showing Claude Code, Codex, and Cursor naturally use
  `aish` after rules are installed.
- No public demo recording.
- No external user install report.
- No public launch feedback log.

These are not blockers:

- `aish logs`
- MCP
- PyPI
- dashboard
- telemetry
- broad cloud adapters

## What Now

P0 evidence tasks, in order:

1. Create `examples/install-transcript.md`.
2. Create `examples/agent-adoption.md`.
3. Record the 45-60 second behavior-change demo.
4. Get one external install from an agent-heavy builder.
5. Launch with the question:
   `What command wastes the most context for your coding agent?`

## Next Engineering Task

No more engineering before the launch proof artifacts unless agent adoption
testing shows generated rules are too weak. `aish logs` remains post-launch.

## After Launch

Use feedback to choose the next wrapper. Current expected order:

1. `aish logs -- <command>`
2. `aish ps` / `aish docker`
3. `aish http -- <command>`
4. `aish gh` / PR summaries, only if demand appears

## Resume Prompt

You are in `/home/yakshith/aish` on Wednesday, July 8, 2026. AgentShell v0 is
done building and `aish benchmark` is implemented. Do not build more wrappers
before launch proof. Next, create the install transcript, agent adoption table,
demo, and external install report.
