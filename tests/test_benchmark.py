from __future__ import annotations

from agentshell import cli
from agentshell.commands.benchmark import BenchmarkCase, Evidence, run, run_case


def test_benchmark_reports_all_cases() -> None:
    result = run()

    assert result.exit_code == 0
    assert "AgentShell benchmark" in result.stdout
    assert "cases=5 evidence=preserved" in result.stdout
    assert "git_diff raw_lines=" in result.stdout
    assert "pytest_failure raw_lines=" in result.stdout
    assert "build_log raw_lines=" in result.stdout
    assert "tree raw_lines=" in result.stdout
    assert "search raw_lines=" in result.stdout
    assert "preserved=files,hunks,additions,deletions,risk_markers" in result.stdout
    assert "preserved=command,exit_code,test_id,file,line,assertion" in result.stdout


def test_benchmark_case_marks_missing_evidence() -> None:
    case = BenchmarkCase(
        name="missing_demo",
        fixture="pytest_failure.txt",
        summarize=lambda raw: "compact without required marker\n",
        evidence=(Evidence("test_id", "tests/test_auth.py::test_empty_password", "not-present"),),
    )

    result = run_case(case)

    assert result.evidence_preserved is False
    assert result.preserved_fields == ()
    assert result.missing_fields == ("test_id",)


def test_benchmark_cli_help_includes_command(capsys) -> None:
    try:
        cli.main(["--help"])
    except SystemExit as exc:
        assert exc.code == 0

    assert "benchmark" in capsys.readouterr().out


def test_benchmark_cli_runs(capsys) -> None:
    exit_code = cli.main(["benchmark"])

    assert exit_code == 0
    out = capsys.readouterr().out
    assert "cases=5 evidence=preserved" in out
    assert "shrink=" in out
