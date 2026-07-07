from __future__ import annotations

from agentshell import cli


def test_help_exits_zero(capsys) -> None:
    try:
        cli.main(["--help"])
    except SystemExit as exc:
        assert exc.code == 0
    out = capsys.readouterr().out
    assert "tree" in out
    assert "init" in out
    assert "doctor" in out
    assert "test" in out


def test_unknown_command_exits_usage(capsys) -> None:
    try:
        cli.main(["nope"])
    except SystemExit as exc:
        assert exc.code == 2
    err = capsys.readouterr().err
    assert "invalid choice" in err


def test_view_missing_file_reports_compact_error(capsys) -> None:
    exit_code = cli.main(["view", "missing.py"])

    assert exit_code == 3
    assert "error=missing_file" in capsys.readouterr().err
