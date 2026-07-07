from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def test_agent_workflow_smoke(tmp_path: Path) -> None:
    sample = tmp_path / "sample_project"
    sample.mkdir()
    (sample / "pyproject.toml").write_text("[project]\nname='sample'\n", encoding="utf-8")
    (sample / "README.md").write_text("login docs\n", encoding="utf-8")
    (sample / "src").mkdir()
    (sample / "src" / "auth.py").write_text(
        "def login():\n    return 200\n\ndef logout():\n    return 204\n",
        encoding="utf-8",
    )
    (sample / "tests").mkdir()
    (sample / "tests" / "test_auth.py").write_text(
        "def test_login():\n    assert 200 == 401\n",
        encoding="utf-8",
    )
    subprocess.run(["git", "init"], cwd=sample, check=True, capture_output=True)

    assert _aish(sample, "tree").returncode == 0
    assert "project=python" in _aish(sample, "tree").stdout
    assert "src/auth.py count=1 lines=1" in _aish(sample, "search", "login").stdout
    assert "1: def login():" in _aish(sample, "view", "src/auth.py:1-2").stdout
    assert "branch=" in _aish(sample, "status").stdout

    failed = _aish(sample, "test", "--", sys.executable, "-c", "print('FAILED tests/test_auth.py::test_login - AssertionError: expected 200'); raise SystemExit(1)")
    assert failed.returncode == 1
    assert "FAIL tests/test_auth.py::test_login" in failed.stdout


def _aish(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    root = Path(__file__).resolve().parents[1]
    env["PYTHONPATH"] = str(root / "src")
    return subprocess.run(
        [sys.executable, "-m", "agentshell", *args],
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
