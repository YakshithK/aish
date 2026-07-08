from __future__ import annotations

import sys

import agentshell.commands.build as build_command
from agentshell.commands.build import run
from agentshell.output import AishError, EXIT_TIMEOUT, EXIT_USAGE
from agentshell.subprocesses import RunResult


def test_missing_build_command_is_usage_error() -> None:
    try:
        run([])
    except AishError as exc:
        assert exc.exit_code == EXIT_USAGE
        assert "missing_build_command" in exc.message
    else:
        raise AssertionError("expected missing command")


def test_passing_build_summarizes_warnings() -> None:
    script = "print('Downloading package'); print('warning: unused import')"

    result = run([sys.executable, "-c", script])

    assert result.exit_code == 0
    assert "status=passed exit=0 warnings=1" in result.stdout
    assert "WARN warning: unused import" in result.stdout
    assert "omitted=progress,downloads,successful_steps" in result.stdout


def test_failed_build_extracts_errors() -> None:
    script = (
        "print('Downloading dependency')\n"
        "print('src/main.c:10:5: error: missing semicolon')\n"
        "print('fatal: build failed')\n"
        "raise SystemExit(2)"
    )

    result = run([sys.executable, "-c", script])

    assert result.exit_code == 2
    assert "status=failed exit=2 warnings=0" in result.stdout
    assert "ERROR src/main.c:10:5: error: missing semicolon" in result.stdout
    assert "ERROR fatal: build failed" in result.stdout
    assert "parser=build" in result.stdout


def test_build_command_not_found_is_compact() -> None:
    result = run(["definitely-not-aish-build-command"])

    assert result.exit_code == 127
    assert "error=command_not_found" in result.stdout


def test_build_timeout_exits_124(monkeypatch) -> None:
    monkeypatch.setattr(
        build_command,
        "run_command",
        lambda cmd: RunResult(cmd, "started", "", EXIT_TIMEOUT, timed_out=True),
    )

    result = run([sys.executable, "-c", "import time; time.sleep(130)"])

    assert result.exit_code == EXIT_TIMEOUT
    assert "status=timeout" in result.stdout
    assert "timeout=true" in result.stdout

