from __future__ import annotations

from pathlib import Path

from agentshell.commands.view import run
from agentshell.output import AishError, EXIT_RUNTIME, EXIT_USAGE


def test_short_text_file_prints_numbered_lines(tmp_path: Path) -> None:
    target = tmp_path / "auth.py"
    target.write_text("def login():\n    return True\n", encoding="utf-8")

    result = run(str(target))

    assert result.exit_code == 0
    assert f"file={target} lines=2 range=1-2" in result.stdout
    assert "1: def login():" in result.stdout


def test_long_file_returns_outline_and_suggested_range(tmp_path: Path) -> None:
    target = tmp_path / "auth.py"
    target.write_text(
        "\n".join(["import os", "", "def login():", "    pass"] + [f"# {i}" for i in range(130)]),
        encoding="utf-8",
    )

    result = run(str(target))

    assert "lines=134" in result.stdout
    assert "imports=1" in result.stdout
    assert "funcs=login:3-" in result.stdout
    assert "use: aish view" in result.stdout
    assert "omitted=full_file" in result.stdout


def test_range_prints_exact_lines(tmp_path: Path) -> None:
    target = tmp_path / "notes.txt"
    target.write_text("a\nb\nc\nd\n", encoding="utf-8")

    result = run(f"{target}:2-3")

    assert f"file={target} lines=4 range=2-3" in result.stdout
    assert "2: b" in result.stdout
    assert "3: c" in result.stdout
    assert "1: a" not in result.stdout


def test_invalid_range_exits_usage() -> None:
    try:
        run("file.py:9-2")
    except AishError as exc:
        assert exc.exit_code == EXIT_USAGE
        assert "invalid_range" in exc.message
    else:
        raise AssertionError("expected invalid range")


def test_missing_file_exits_runtime(tmp_path: Path) -> None:
    try:
        run(str(tmp_path / "missing.py"))
    except AishError as exc:
        assert exc.exit_code == EXIT_RUNTIME
        assert "missing_file" in exc.message
    else:
        raise AssertionError("expected missing file")


def test_binary_file_is_not_dumped(tmp_path: Path) -> None:
    target = tmp_path / "blob.bin"
    target.write_bytes(b"\x00\x01secret")

    result = run(str(target))

    assert "binary=true" in result.stdout
    assert "secret" not in result.stdout


def test_non_utf8_uses_replacement_decode(tmp_path: Path) -> None:
    target = tmp_path / "latin.txt"
    target.write_bytes(b"ok\nbad:\xff\n")

    result = run(str(target))

    assert "2: bad:" in result.stdout
