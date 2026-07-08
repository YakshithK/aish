from __future__ import annotations

import re

from agentshell.output import AishError, CommandResult, EXIT_TIMEOUT, EXIT_USAGE, join_lines, quote_command, truncate_value
from agentshell.subprocesses import RunResult, run_command


BUILD_MAX_EVIDENCE = 12


def run(cmd: list[str]) -> CommandResult:
    if not cmd:
        raise AishError("error=missing_build_command use='aish build -- <command...>'", EXIT_USAGE)

    result = run_command(cmd)
    if result.timed_out:
        return CommandResult(
            join_lines(
                [
                    f"status=timeout exit={EXIT_TIMEOUT} timeout=true command=\"{quote_command(cmd)}\"",
                    *_tail_lines(result.stdout + "\n" + result.stderr, 8),
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
    warnings = _warning_count(output)
    if result.exit_code == 0:
        return CommandResult(
            join_lines(
                [
                    f"status=passed exit=0 warnings={warnings} command=\"{quote_command(cmd)}\"",
                    *_warning_lines(output),
                    "omitted=progress,downloads,successful_steps",
                    _truncated_line(result),
                ]
            )
        )

    evidence = _failure_evidence(output)
    return CommandResult(
        join_lines(
            [
                f"status=failed exit={result.exit_code} warnings={warnings} command=\"{quote_command(cmd)}\"",
                *evidence,
                "omitted=progress,downloads,successful_steps",
                "parser=build",
                _truncated_line(result),
            ]
        ),
        exit_code=result.exit_code,
    )


def _failure_evidence(output: str) -> list[str]:
    evidence: list[str] = []
    for line in output.splitlines():
        stripped = line.strip()
        if not stripped or _is_noise(stripped):
            continue
        if _is_error(stripped):
            evidence.append(f"ERROR {truncate_value(stripped)}")
        if len(evidence) >= BUILD_MAX_EVIDENCE:
            break
    if evidence:
        return _dedupe(evidence)
    tail = _tail_lines(output, BUILD_MAX_EVIDENCE)
    return tail or ["TAIL no_build_output"]


def _warning_lines(output: str) -> list[str]:
    lines: list[str] = []
    for line in output.splitlines():
        stripped = line.strip()
        if _is_warning(stripped):
            lines.append(f"WARN {truncate_value(stripped)}")
        if len(lines) >= 5:
            break
    return _dedupe(lines)


def _tail_lines(output: str, limit: int) -> list[str]:
    useful = [line.strip() for line in output.splitlines() if line.strip() and not _is_noise(line.strip())]
    return [f"TAIL {truncate_value(line)}" for line in useful[-limit:]]


def _warning_count(output: str) -> int:
    return sum(1 for line in output.splitlines() if _is_warning(line.strip()))


def _is_error(line: str) -> bool:
    lower = line.lower()
    return (
        "error:" in lower
        or lower.startswith("error ")
        or lower.startswith("fatal:")
        or " failed" in lower
        or lower.startswith("failed ")
        or "traceback " in lower
        or "exception" in lower
    )


def _is_warning(line: str) -> bool:
    lower = line.lower()
    return "warning:" in lower or lower.startswith("warn ")


def _is_noise(line: str) -> bool:
    return bool(
        re.match(r"^[.=#* -]+$", line)
        or re.match(r"^\[\d+/\d+\]", line)
        or re.match(r"^\d+%|\d+\.\d+%$", line)
        or line.startswith("Downloading ")
        or line.startswith("Installing ")
        or line.startswith("Collecting ")
        or line.startswith("Requirement already satisfied")
    )


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

