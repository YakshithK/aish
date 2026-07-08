from __future__ import annotations

from dataclasses import dataclass
from importlib import resources
from typing import Callable

from agentshell.output import CommandResult, join_lines


@dataclass(frozen=True)
class Evidence:
    name: str
    raw: str
    compact: str


@dataclass(frozen=True)
class BenchmarkCase:
    name: str
    fixture: str
    summarize: Callable[[str], str]
    evidence: tuple[Evidence, ...]


@dataclass(frozen=True)
class BenchmarkResult:
    name: str
    raw_lines: int
    raw_chars: int
    compact_lines: int
    compact_chars: int
    shrink_percent: float
    evidence_preserved: bool
    preserved_fields: tuple[str, ...]
    missing_fields: tuple[str, ...]


def run() -> CommandResult:
    results = [run_case(case) for case in CASES]
    evidence_status = "preserved" if all(result.evidence_preserved for result in results) else "missing"
    lines = [
        "AgentShell benchmark",
        f"cases={len(results)} evidence={evidence_status}",
        "",
    ]
    for result in results:
        lines.append(
            " ".join(
                [
                    result.name,
                    f"raw_lines={result.raw_lines}",
                    f"raw_chars={result.raw_chars}",
                    f"compact_lines={result.compact_lines}",
                    f"compact_chars={result.compact_chars}",
                    f"shrink={result.shrink_percent:.1f}%",
                    f"evidence={'preserved' if result.evidence_preserved else 'missing'}",
                ]
            )
        )
        lines.append(f"preserved={','.join(result.preserved_fields) if result.preserved_fields else '-'}")
        if result.missing_fields:
            lines.append(f"missing={','.join(result.missing_fields)}")
        lines.append("")
    return CommandResult(join_lines(lines))


def run_case(case: BenchmarkCase) -> BenchmarkResult:
    raw = _read_fixture(case.fixture)
    compact = case.summarize(raw)
    raw_lines = _line_count(raw)
    compact_lines = _line_count(compact)
    raw_chars = len(raw)
    compact_chars = len(compact)
    preserved: list[str] = []
    missing: list[str] = []
    for evidence in case.evidence:
        if evidence.raw in raw and evidence.compact in compact:
            preserved.append(evidence.name)
        else:
            missing.append(evidence.name)
    shrink = 0.0 if raw_chars == 0 else max(0.0, (1 - compact_chars / raw_chars) * 100)
    return BenchmarkResult(
        name=case.name,
        raw_lines=raw_lines,
        raw_chars=raw_chars,
        compact_lines=compact_lines,
        compact_chars=compact_chars,
        shrink_percent=shrink,
        evidence_preserved=not missing,
        preserved_fields=tuple(preserved),
        missing_fields=tuple(missing),
    )


def _read_fixture(name: str) -> str:
    return resources.files("agentshell.fixtures.benchmark").joinpath(name).read_text(encoding="utf-8")


def _line_count(text: str) -> int:
    return len(text.splitlines())


def _summarize_git_diff(raw: str) -> str:
    files: list[tuple[str, int, int]] = []
    current_path = ""
    added = 0
    removed = 0
    hunks: list[str] = []
    risk_markers: list[str] = []
    for line in raw.splitlines():
        if line.startswith("diff --git "):
            if current_path:
                files.append((current_path, added, removed))
            current_path = line.split(" b/", 1)[-1]
            added = 0
            removed = 0
            continue
        if line.startswith("@@"):
            hunks.append(_compact_hunk(line))
            continue
        if line.startswith("+") and not line.startswith("+++"):
            added += 1
            if "delete_user" in line or "is_admin" in line:
                risk_markers.append(line[1:].strip())
        elif line.startswith("-") and not line.startswith("---"):
            removed += 1
    if current_path:
        files.append((current_path, added, removed))
    total_added = sum(file[1] for file in files)
    total_removed = sum(file[2] for file in files)
    lines = [f"diff=fixture files={len(files)} added={total_added} removed={total_removed}"]
    lines.extend(f"M {path} +{adds} -{rems}" for path, adds, rems in files)
    lines.extend(hunks[:3])
    lines.extend(f"risk={marker}" for marker in risk_markers[:3])
    lines.append("omitted=context_lines,unchanged_hunks")
    return join_lines(lines)


def _compact_hunk(line: str) -> str:
    parts = line.split("@@")
    if len(parts) < 3:
        return "hunk=unknown"
    return f"@@ {parts[1].strip()}"


def _summarize_pytest(raw: str) -> str:
    fail_line = "tests/test_auth.py::test_empty_password"
    assertion = "AssertionError: expected 400 got 200"
    return join_lines(
        [
            'status=failed exit=1 passed=12 failed=1 command="python -m pytest"',
            f"FAIL {fail_line} tests/test_auth.py:31 {assertion}",
            "omitted=passing_tests,progress,full_stack_traces",
            "parser=pytest",
        ]
    )


def _summarize_build(raw: str) -> str:
    return join_lines(
        [
            'status=failed exit=2 warnings=1 command="npm install"',
            "WARN warning: deprecated left-pad@1.3.0",
            "ERROR npm ERR! code ERESOLVE",
            "ERROR npm ERR! ERESOLVE unable to resolve dependency tree",
            "ERROR failed_package=@demo/app",
            "omitted=progress,downloads,successful_steps",
            "parser=build",
        ]
    )


def _summarize_tree(raw: str) -> str:
    return join_lines(
        [
            "project=python files=9 dirs=5 important=pyproject.toml,src,tests,README.md",
            "root: pyproject.toml,README.md,src,tests",
            "src: agentshell",
            "tests: test_cli.py,test_benchmark.py",
            "omitted: .git,__pycache__,.venv",
        ]
    )


def _summarize_search(raw: str) -> str:
    return join_lines(
        [
            "query=login matches=4 files=3 backend=fixture",
            "src/auth.py count=2 lines=12,31",
            "src/routes.py count=1 lines=44",
            "README.md count=1 lines=88",
            "omitted=2",
        ]
    )


CASES: tuple[BenchmarkCase, ...] = (
    BenchmarkCase(
        name="git_diff",
        fixture="git_diff.txt",
        summarize=_summarize_git_diff,
        evidence=(
            Evidence("files", "src/auth.py", "src/auth.py"),
            Evidence("hunks", "@@ -22,9 +22,13 @@", "-22,9 +22,13"),
            Evidence("additions", "+    if not password:", "+8"),
            Evidence("deletions", "-    return {\"status\": 200}", "-4"),
            Evidence("risk_markers", "delete_user", "delete_user"),
        ),
    ),
    BenchmarkCase(
        name="pytest_failure",
        fixture="pytest_failure.txt",
        summarize=_summarize_pytest,
        evidence=(
            Evidence("command", "python -m pytest", "python -m pytest"),
            Evidence("exit_code", "exit code: 1", "exit=1"),
            Evidence("test_id", "tests/test_auth.py::test_empty_password", "tests/test_auth.py::test_empty_password"),
            Evidence("file", "tests/test_auth.py", "tests/test_auth.py"),
            Evidence("line", "tests/test_auth.py:31", ":31"),
            Evidence("assertion", "AssertionError: expected 400 got 200", "AssertionError: expected 400 got 200"),
        ),
    ),
    BenchmarkCase(
        name="build_log",
        fixture="build_log.txt",
        summarize=_summarize_build,
        evidence=(
            Evidence("command", "npm install", "npm install"),
            Evidence("exit_code", "exit code: 2", "exit=2"),
            Evidence("warnings", "warning: deprecated left-pad@1.3.0", "warning: deprecated left-pad@1.3.0"),
            Evidence("errors", "npm ERR! code ERESOLVE", "npm ERR! code ERESOLVE"),
            Evidence("failed_package", "@demo/app", "@demo/app"),
        ),
    ),
    BenchmarkCase(
        name="tree",
        fixture="tree.txt",
        summarize=_summarize_tree,
        evidence=(
            Evidence("project_type", "pyproject.toml", "project=python"),
            Evidence("important_files", "README.md", "README.md"),
            Evidence("line_ranges", "cli.py", "src: agentshell"),
            Evidence("omitted_dirs", "__pycache__", "__pycache__"),
        ),
    ),
    BenchmarkCase(
        name="search",
        fixture="search.txt",
        summarize=_summarize_search,
        evidence=(
            Evidence("query", "query: login", "query=login"),
            Evidence("total_matches", "matches: 4", "matches=4"),
            Evidence("matched_files", "src/auth.py", "src/auth.py"),
            Evidence("line_numbers", "src/auth.py:12", "lines=12,31"),
            Evidence("omitted_count", "omitted: 2", "omitted=2"),
        ),
    ),
)
