from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from .output import AishError, EXIT_RUNTIME, EXIT_USAGE


IGNORED_NAMES = {
    ".git",
    ".agents",
    ".codex",
    "node_modules",
    "dist",
    "build",
    "target",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}

VIEW_INLINE_MAX_LINES = 120
VIEW_RANGE_MAX_LINES = 240
TREE_MAX_DEPTH = 3
TREE_MAX_FILES = 200
SEARCH_MAX_FILES = 20
SEARCH_MAX_LINES_PER_FILE = 5
TEST_CAPTURE_MAX_BYTES = 200_000
TEST_OUTPUT_MAX_LINES = 80
SUBPROCESS_TIMEOUT_DEFAULT = 120


@dataclass(frozen=True)
class FileRange:
    path: Path
    start: int | None = None
    end: int | None = None


def is_ignored(path: Path) -> bool:
    return any(part in IGNORED_NAMES for part in path.parts)


def parse_path_range(raw: str) -> FileRange:
    path_text = raw
    start: int | None = None
    end: int | None = None
    match = re.match(r"^(?P<path>.+):(?P<start>\d+)-(?P<end>\d+)$", raw)
    if match:
        path_text = match.group("path")
        start = int(match.group("start"))
        end = int(match.group("end"))
        if start < 1 or end < start:
            raise AishError("error=invalid_range expected=START-END", EXIT_USAGE)
        if end - start + 1 > VIEW_RANGE_MAX_LINES:
            raise AishError(
                f"error=range_too_large max_lines={VIEW_RANGE_MAX_LINES}",
                EXIT_USAGE,
            )
    return FileRange(Path(path_text), start, end)


def require_file(path: Path) -> Path:
    if not path.exists():
        raise AishError(f"error=missing_file path={path}", EXIT_RUNTIME)
    if path.is_dir():
        raise AishError(f"error=is_directory path={path}", EXIT_RUNTIME)
    return path


def looks_binary(path: Path, sample_size: int = 4096) -> bool:
    with path.open("rb") as handle:
        sample = handle.read(sample_size)
    if b"\x00" in sample:
        return True
    if not sample:
        return False
    control = sum(1 for byte in sample if byte < 9 or (13 < byte < 32))
    return control / len(sample) > 0.20


def count_lines(path: Path) -> int:
    total = 0
    with path.open("rb") as handle:
        for _ in handle:
            total += 1
    return total


def read_text_lines(path: Path, start: int | None = None, end: int | None = None) -> list[tuple[int, str]]:
    lines: list[tuple[int, str]] = []
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for number, line in enumerate(handle, start=1):
            if start is not None and number < start:
                continue
            if end is not None and number > end:
                break
            lines.append((number, line.rstrip("\n")))
    return lines


def iter_searchable_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for current, dirnames, filenames in os.walk(root):
        current_path = Path(current)
        dirnames[:] = [
            name
            for name in sorted(dirnames)
            if name not in IGNORED_NAMES and not (current_path / name).is_symlink()
        ]
        for name in sorted(filenames):
            path = current_path / name
            if not is_ignored(path.relative_to(root)) and not path.is_symlink():
                files.append(path)
    return files
