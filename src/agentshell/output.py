from __future__ import annotations

from dataclasses import dataclass


EXIT_OK = 0
EXIT_CHILD_FAILED = 1
EXIT_USAGE = 2
EXIT_RUNTIME = 3
EXIT_TIMEOUT = 124


@dataclass
class CommandResult:
    stdout: str
    stderr: str = ""
    exit_code: int = EXIT_OK


class AishError(Exception):
    def __init__(self, message: str, exit_code: int = EXIT_RUNTIME) -> None:
        super().__init__(message)
        self.message = message
        self.exit_code = exit_code


def join_lines(lines: list[str]) -> str:
    return "\n".join(line for line in lines if line is not None).rstrip() + "\n"


def truncate_value(value: str, limit: int = 180) -> str:
    if len(value) <= limit:
        return value
    return value[: max(0, limit - len("...truncated"))] + "...truncated"


def csv(items: list[str], empty: str = "-") -> str:
    return ",".join(items) if items else empty


def quote_command(args: list[str]) -> str:
    return " ".join(_quote_arg(arg) for arg in args)


def _quote_arg(arg: str) -> str:
    if not arg:
        return "''"
    if all(ch.isalnum() or ch in "-_./:=+" for ch in arg):
        return arg
    return "'" + arg.replace("'", "'\"'\"'") + "'"
