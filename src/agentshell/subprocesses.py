from __future__ import annotations

import subprocess
from dataclasses import dataclass

from .fs import SUBPROCESS_TIMEOUT_DEFAULT, TEST_CAPTURE_MAX_BYTES
from .output import EXIT_RUNTIME, EXIT_TIMEOUT


@dataclass(frozen=True)
class RunResult:
    args: list[str]
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool = False
    truncated: bool = False
    missing: bool = False


def run_command(args: list[str], timeout: int = SUBPROCESS_TIMEOUT_DEFAULT) -> RunResult:
    try:
        completed = subprocess.run(
            args,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            shell=False,
        )
    except FileNotFoundError as exc:
        return RunResult(args, "", f"error=command_not_found command={exc.filename}", 127, missing=True)
    except subprocess.TimeoutExpired as exc:
        stdout = _coerce_output(exc.stdout)
        stderr = _coerce_output(exc.stderr)
        return RunResult(args, stdout, stderr, EXIT_TIMEOUT, timed_out=True)
    except OSError as exc:
        return RunResult(args, "", f"error=subprocess_failed detail={exc}", EXIT_RUNTIME)

    stdout, out_truncated = _cap_text(completed.stdout)
    stderr, err_truncated = _cap_text(completed.stderr)
    return RunResult(
        args,
        stdout,
        stderr,
        completed.returncode,
        truncated=out_truncated or err_truncated,
    )


def _coerce_output(value: str | bytes | None) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _cap_text(value: str) -> tuple[str, bool]:
    encoded = value.encode("utf-8", errors="replace")
    if len(encoded) <= TEST_CAPTURE_MAX_BYTES:
        return value, False
    clipped = encoded[:TEST_CAPTURE_MAX_BYTES].decode("utf-8", errors="replace")
    return clipped + "\n...truncated", True
