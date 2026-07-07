from __future__ import annotations

import shutil
from collections import OrderedDict
from pathlib import Path

from agentshell.fs import SEARCH_MAX_FILES, SEARCH_MAX_LINES_PER_FILE, iter_searchable_files, looks_binary
from agentshell.output import CommandResult, EXIT_CHILD_FAILED, csv, join_lines
from agentshell.subprocesses import run_command


def run(query: str, path: str = ".") -> CommandResult:
    root = Path(path)
    if shutil.which("rg"):
        matches = _search_rg(query, root)
        backend = "rg"
    else:
        matches = _search_python(query, root)
        backend = "python"

    total = sum(len(lines) for lines in matches.values())
    output = _render(query, backend, matches, total)
    return CommandResult(output, exit_code=0 if total else EXIT_CHILD_FAILED)


def _search_rg(query: str, root: Path) -> OrderedDict[str, list[int]]:
    result = run_command(["rg", "--line-number", "--no-heading", "--color", "never", query, str(root)])
    matches: OrderedDict[str, list[int]] = OrderedDict()
    if result.exit_code not in (0, 1):
        return matches
    for line in result.stdout.splitlines():
        parts = line.split(":", 2)
        if len(parts) < 3 or not parts[1].isdigit():
            continue
        file_name = _display_path(Path(parts[0]), root)
        _add_match(matches, file_name, int(parts[1]))
    return matches


def _search_python(query: str, root: Path) -> OrderedDict[str, list[int]]:
    matches: OrderedDict[str, list[int]] = OrderedDict()
    needle = query.lower()
    for path in iter_searchable_files(root):
        if len(matches) >= SEARCH_MAX_FILES:
            break
        if looks_binary(path):
            continue
        try:
            with path.open("r", encoding="utf-8", errors="replace") as handle:
                for number, line in enumerate(handle, start=1):
                    if needle in line.lower():
                        _add_match(matches, _display_path(path, root), number)
        except OSError:
            continue
    return matches


def _add_match(matches: OrderedDict[str, list[int]], file_name: str, line: int) -> None:
    if file_name not in matches and len(matches) >= SEARCH_MAX_FILES:
        return
    lines = matches.setdefault(file_name, [])
    if len(lines) < SEARCH_MAX_LINES_PER_FILE:
        lines.append(line)


def _render(query: str, backend: str, matches: OrderedDict[str, list[int]], total: int) -> str:
    lines = [f"query={query} matches={total} files={len(matches)} backend={backend}"]
    for file_name, line_numbers in matches.items():
        lines.append(f"{file_name} count={len(line_numbers)} lines={csv([str(n) for n in line_numbers])}")
    if len(matches) >= SEARCH_MAX_FILES:
        lines.append("omitted=max_files")
    return join_lines(lines)


def _display_path(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)
