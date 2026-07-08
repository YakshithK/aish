from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from agentshell.output import CommandResult, EXIT_RUNTIME, join_lines, truncate_value
from agentshell.subprocesses import run_command


DIFF_MAX_FILES = 40
DIFF_MAX_HUNK_LINES = 80


@dataclass(frozen=True)
class DiffFile:
    status: str
    path: str
    added: int
    removed: int


def run(path: str = ".", target: str | None = None, staged: bool = False) -> CommandResult:
    root = Path(path)
    inside = run_command(["git", "-C", str(root), "rev-parse", "--is-inside-work-tree"])
    if inside.exit_code != 0:
        return CommandResult("error=not_git_repo\n", exit_code=EXIT_RUNTIME)

    scope_args, scope = _scope_args(root, target, staged)
    files = _changed_files(root, scope_args)
    if target and len(files) <= 1:
        return _file_diff(root, scope_args, files, scope)
    return _summary(files, scope)


def _scope_args(root: Path, target: str | None, staged: bool) -> tuple[list[str], str]:
    args: list[str] = []
    scope = "staged" if staged else "unstaged"
    if staged:
        args.append("--cached")
    if target:
        if (root / target).exists() or _looks_like_path(target):
            args.extend(["--", target])
            scope = f"file:{target}"
        else:
            args.insert(0, target)
            scope = f"ref:{target}"
    return args, scope


def _changed_files(root: Path, scope_args: list[str]) -> list[DiffFile]:
    numstat = run_command(["git", "-C", str(root), "diff", "--numstat", "--no-ext-diff", *scope_args])
    if numstat.exit_code != 0:
        return []
    statuses = _name_status(root, scope_args)
    files: list[DiffFile] = []
    for line in numstat.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        added = _parse_count(parts[0])
        removed = _parse_count(parts[1])
        path = _clean_path(parts[-1])
        files.append(DiffFile(statuses.get(path, "M"), path, added, removed))
    return files


def _name_status(root: Path, scope_args: list[str]) -> dict[str, str]:
    result = run_command(["git", "-C", str(root), "diff", "--name-status", "--no-ext-diff", *scope_args])
    statuses: dict[str, str] = {}
    for line in result.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            statuses[_clean_path(parts[-1])] = parts[0][0]
    return statuses


def _summary(files: list[DiffFile], scope: str) -> CommandResult:
    added = sum(file.added for file in files)
    removed = sum(file.removed for file in files)
    lines = [f"diff={scope} files={len(files)} added={added} removed={removed}"]
    for file in files[:DIFF_MAX_FILES]:
        lines.append(f"{file.status} {file.path} +{file.added} -{file.removed}")
    if len(files) > DIFF_MAX_FILES:
        lines.append(f"omitted={len(files) - DIFF_MAX_FILES}")
    if files:
        lines.append(f"next: aish diff {files[0].path}")
    else:
        lines.append("next: no_changes")
    return CommandResult(join_lines(lines))


def _file_diff(root: Path, scope_args: list[str], files: list[DiffFile], scope: str) -> CommandResult:
    patch = run_command(["git", "-C", str(root), "diff", "--no-ext-diff", "--unified=3", *scope_args])
    if patch.exit_code != 0:
        return CommandResult("error=git_diff_failed\n", patch.stderr, EXIT_RUNTIME)

    added = sum(file.added for file in files)
    removed = sum(file.removed for file in files)
    file_label = files[0].path if files else scope
    lines = [f"file={file_label} added={added} removed={removed}"]
    hunk_lines, omitted = _compact_hunks(patch.stdout)
    lines.extend(hunk_lines)
    if omitted:
        lines.append("omitted=context_lines,unchanged_hunks")
    return CommandResult(join_lines(lines))


def _compact_hunks(patch: str) -> tuple[list[str], bool]:
    lines: list[str] = []
    omitted = False
    for raw in patch.splitlines():
        if raw.startswith("@@"):
            lines.append(_hunk_header(raw))
        elif raw.startswith("+") and not raw.startswith("+++"):
            lines.append(truncate_value(raw))
        elif raw.startswith("-") and not raw.startswith("---"):
            lines.append(truncate_value(raw))
        elif raw.startswith("diff --git") or raw.startswith("index "):
            omitted = True
        else:
            omitted = True
        if len(lines) >= DIFF_MAX_HUNK_LINES:
            omitted = True
            break
    return lines or ["hunks=0"], omitted


def _hunk_header(line: str) -> str:
    match = re.match(r"@@ -(?P<old>\d+)(?:,\d+)? \+(?P<new>\d+)(?:,(?P<count>\d+))? @@", line)
    if not match:
        return truncate_value(line)
    start = int(match.group("new"))
    count = int(match.group("count") or "1")
    end = start + max(count - 1, 0)
    return f"@@ lines={start}-{end}"


def _parse_count(value: str) -> int:
    return 0 if value == "-" else int(value)


def _clean_path(path: str) -> str:
    if " => " in path:
        return path.split(" => ", 1)[1].strip("{}")
    return path


def _looks_like_path(value: str) -> bool:
    return "/" in value or "." in value

