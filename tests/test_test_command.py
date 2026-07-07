from __future__ import annotations

import sys

import agentshell.commands.test as test_command
from agentshell.commands.test import run
from agentshell.output import AishError, EXIT_TIMEOUT, EXIT_USAGE
from agentshell.subprocesses import RunResult


def test_missing_command_is_usage_error() -> None:
    try:
        run([])
    except AishError as exc:
        assert exc.exit_code == EXIT_USAGE
        assert "missing_test_command" in exc.message
    else:
        raise AssertionError("expected missing command")


def test_passing_command_preserves_zero_exit() -> None:
    result = run([sys.executable, "-c", "print('3 passed')"])

    assert result.exit_code == 0
    assert "status=passed exit=0" in result.stdout
    assert "passed=3 failed=0" in result.stdout


def test_pytest_failure_summary_preserves_exit_code() -> None:
    script = "print('FAILED tests/test_auth.py::test_login - AssertionError: expected 200'); raise SystemExit(1)"

    result = run([sys.executable, "-c", script])

    assert result.exit_code == 1
    assert "status=failed exit=1" in result.stdout
    assert "FAIL tests/test_auth.py::test_login AssertionError: expected 200" in result.stdout
    assert "parser=pytest" in result.stdout


def test_generic_failure_uses_bounded_tail() -> None:
    script = "print('banner'); print('RuntimeError: nope'); raise SystemExit(7)"

    result = run([sys.executable, "-c", script])

    assert result.exit_code == 7
    assert "TAIL RuntimeError: nope" in result.stdout
    assert "parser=generic" in result.stdout


def test_command_not_found_is_compact() -> None:
    result = run(["definitely-not-aish-command"])

    assert result.exit_code == 127
    assert "error=command_not_found" in result.stdout


def test_timeout_exits_124(monkeypatch) -> None:
    monkeypatch.setattr(
        test_command,
        "run_command",
        lambda cmd: RunResult(cmd, "started", "", EXIT_TIMEOUT, timed_out=True),
    )

    result = run([sys.executable, "-c", "import time; time.sleep(130)"])

    assert result.exit_code == EXIT_TIMEOUT
    assert "status=timeout" in result.stdout
    assert "timeout=true" in result.stdout
