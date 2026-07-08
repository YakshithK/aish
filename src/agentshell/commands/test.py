from __future__ import annotations

import re

from agentshell.fs import TEST_OUTPUT_MAX_LINES
from agentshell.output import AishError, CommandResult, EXIT_TIMEOUT, EXIT_USAGE, join_lines, quote_command, truncate_value
from agentshell.subprocesses import RunResult, run_command


def run(cmd: list[str]) -> CommandResult:
    if not cmd:
        raise AishError("error=missing_test_command use='aish test -- <command...>'", EXIT_USAGE)

    result = run_command(cmd)
    if result.timed_out:
        return CommandResult(
            join_lines(
                [
                    f"status=timeout exit={EXIT_TIMEOUT} timeout=true command=\"{quote_command(cmd)}\"",
                    *_tail_lines(result.stdout + "\n" + result.stderr, 10),
                ]
            ),
            exit_code=EXIT_TIMEOUT,
        )
    if result.missing:
        return CommandResult(
            join_lines(
                [
                    f"status=error exit={result.exit_code} command=\"{quote_command(cmd)}\"",
                    result.stderr,
                ]
            ),
            exit_code=result.exit_code,
        )

    output = (result.stdout + "\n" + result.stderr).strip()
    if result.exit_code == 0:
        return CommandResult(
            join_lines(
                [
                    f"status=passed exit=0 command=\"{quote_command(cmd)}\"",
                    _passed_counts(output),
                    _truncated_line(result),
                ]
            ),
            exit_code=0,
        )

    parser, lines = _parse_failure(output)
    passed, failed = _failure_counts(output, len(lines))
    summary = [
        f"status=failed exit={result.exit_code} passed={passed} failed={failed} command=\"{quote_command(cmd)}\"",
        *lines,
        "omitted=passing_tests,progress,full_stack_traces",
        f"parser={parser}",
        _truncated_line(result),
    ]
    return CommandResult(join_lines(summary), exit_code=result.exit_code)


def _passed_counts(output: str) -> str:
    match = re.search(r"(\d+)\s+passed", output)
    if match:
        return f"passed={match.group(1)} failed=0"
    return "passed=? failed=0"


def _parse_failure(output: str) -> tuple[str, list[str]]:
    if "FAILURES" in output or re.search(r"FAILED .+::", output):
        return "pytest", _parse_pytest(output)
    if re.search(r"--- FAIL: \w+", output):
        return "go", _parse_go(output)
    if re.search(r"(^|\n)\s*FAIL\s+", output) or re.search(r"(^|\n)\s*[×✕]\s+", output):
        return "javascript", _parse_javascript(output)
    if "test result: FAILED" in output or re.search(r"---- .+ stdout ----", output):
        return "cargo", _parse_cargo(output)
    if re.search(r"FAIL: .* \(", output) or "FAILED (" in output:
        return "unittest", _parse_unittest(output)
    if re.search(r"\bFAIL\b|AssertionError|Error:", output):
        return "generic", _parse_generic(output)
    return "generic", _parse_generic(output)


def _parse_pytest(output: str) -> list[str]:
    failures: list[str] = []
    for line in output.splitlines():
        line = line.strip()
        match = re.match(r"FAILED\s+([^\s]+)\s+-\s+(.+)", line)
        if match:
            failures.append(f"FAIL {match.group(1)} {truncate_value(match.group(2))}")
        if len(failures) >= 10:
            break
    if failures:
        return failures

    for line in output.splitlines():
        if line.startswith("E   "):
            failures.append(f"FAIL {truncate_value(line[4:])}")
            break
    return failures or _parse_generic(output)


def _parse_unittest(output: str) -> list[str]:
    lines: list[str] = []
    for line in output.splitlines():
        match = re.match(r"FAIL: (.+)", line.strip())
        if match:
            lines.append(f"FAIL {truncate_value(match.group(1))}")
    return lines[:10] or _parse_generic(output)


def _parse_javascript(output: str) -> list[str]:
    lines: list[str] = []
    current_file = ""
    for line in output.splitlines():
        stripped = line.strip()
        suite = re.match(r"FAIL\s+(.+)", stripped)
        if suite:
            current_file = truncate_value(suite.group(1), 100)
            continue
        test = re.match(r"[×✕]\s+(.+)", stripped)
        if test:
            label = f"{current_file} {test.group(1)}".strip()
            lines.append(f"FAIL {truncate_value(label)}")
        if len(lines) >= 10:
            break
    if not lines and current_file:
        lines.append(f"FAIL {current_file}")
    return _dedupe(lines) or _parse_generic(output)


def _parse_cargo(output: str) -> list[str]:
    lines: list[str] = []
    for line in output.splitlines():
        stripped = line.strip()
        header = re.match(r"----\s+(.+?)\s+stdout\s+----", stripped)
        if header:
            lines.append(f"FAIL {truncate_value(header.group(1))}")
            continue
        panic = re.search(r"panicked at (.+)", stripped)
        if panic and lines:
            lines[-1] = f"{lines[-1]} {truncate_value(panic.group(1), 120)}"
        if len(lines) >= 10:
            break
    return lines or _parse_generic(output)


def _parse_go(output: str) -> list[str]:
    lines: list[str] = []
    active = ""
    for line in output.splitlines():
        stripped = line.strip()
        fail = re.match(r"--- FAIL:\s+(\S+)", stripped)
        if fail:
            active = fail.group(1)
            lines.append(f"FAIL {active}")
            continue
        detail = re.match(r"([A-Za-z0-9_./-]+\.go:\d+):\s+(.+)", stripped)
        if detail and active:
            lines[-1] = f"FAIL {active} {detail.group(1)} {truncate_value(detail.group(2), 120)}"
        if len(lines) >= 10:
            break
    return lines or _parse_generic(output)


def _parse_generic(output: str) -> list[str]:
    useful = [
        line.strip()
        for line in output.splitlines()
        if line.strip() and not _is_noise(line.strip())
    ]
    return [f"TAIL {truncate_value(line)}" for line in useful[-TEST_OUTPUT_MAX_LINES:]][-12:] or ["TAIL no_failure_output"]


def _tail_lines(output: str, limit: int) -> list[str]:
    useful = [line.strip() for line in output.splitlines() if line.strip()]
    return [f"TAIL {truncate_value(line)}" for line in useful[-limit:]]


def _is_noise(line: str) -> bool:
    return bool(
        re.match(r"^[.= -]+$", line)
        or re.match(r"^\d+%|\[\d+/\d+\]", line)
        or line.startswith("collected ")
    )


def _failure_counts(output: str, fallback_failed: int) -> tuple[str, str]:
    patterns = [
        (r"(\d+)\s+passed.*?(\d+)\s+failed", False),
        (r"(\d+)\s+failed.*?(\d+)\s+passed", True),
        (r"Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed", True),
        (r"test result: FAILED\.\s+(\d+)\s+passed;\s+(\d+)\s+failed", False),
        (r"FAIL\s+.+\nFAIL\nFAIL\s+.+", False),
    ]
    for pattern, reversed_groups in patterns:
        match = re.search(pattern, output, re.DOTALL)
        if match and len(match.groups()) >= 2:
            first, second = match.group(1), match.group(2)
            return (second, first) if reversed_groups else (first, second)

    go_failed = len(re.findall(r"--- FAIL:", output))
    if go_failed:
        return "?", str(go_failed)
    return "?", str(fallback_failed) if fallback_failed else "?"


def _dedupe(lines: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for line in lines:
        if line not in seen:
            unique.append(line)
            seen.add(line)
    return unique


def _truncated_line(result: RunResult) -> str:
    return "truncated=true" if result.truncated else "truncated=false"
