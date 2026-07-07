from __future__ import annotations

import re
from pathlib import Path

from agentshell.fs import (
    VIEW_INLINE_MAX_LINES,
    count_lines,
    looks_binary,
    parse_path_range,
    read_text_lines,
    require_file,
)
from agentshell.output import CommandResult, join_lines


def run(target: str) -> CommandResult:
    file_range = parse_path_range(target)
    path = require_file(file_range.path)

    if looks_binary(path):
        return CommandResult(join_lines([f"file={path} binary=true lines=? omitted=content"]))

    total_lines = count_lines(path)
    if file_range.start is not None and file_range.end is not None:
        return CommandResult(_render_lines(path, total_lines, file_range.start, file_range.end))

    if total_lines <= VIEW_INLINE_MAX_LINES:
        return CommandResult(_render_lines(path, total_lines, 1, total_lines))

    return CommandResult(_render_outline(path, total_lines))


def _render_lines(path: Path, total_lines: int, start: int, end: int) -> str:
    visible = read_text_lines(path, start, min(end, total_lines))
    lines = [f"file={path} lines={total_lines} range={start}-{min(end, total_lines)}"]
    lines.extend(f"{number}: {text}" for number, text in visible)
    if end > total_lines:
        lines.append("omitted=range_past_eof")
    return join_lines(lines)


def _render_outline(path: Path, total_lines: int) -> str:
    outline = _outline(path)
    summary = [
        f"file={path} lines={total_lines} imports={outline['imports']} exports={outline['exports']} funcs={','.join(outline['funcs']) or '-'}",
    ]
    if outline["funcs"]:
        first = outline["funcs"][0].split(":", 1)[1]
        summary.append(f"use: aish view {path}:{first}")
    else:
        summary.append(f"use: aish view {path}:1-{min(VIEW_INLINE_MAX_LINES, total_lines)}")
    summary.append("omitted=full_file")
    return join_lines(summary)


def _outline(path: Path) -> dict[str, int | list[str]]:
    imports = 0
    exports = 0
    funcs: list[str] = []
    patterns = [
        re.compile(r"^\s*def\s+([A-Za-z_][\w]*)\s*\("),
        re.compile(r"^\s*async\s+def\s+([A-Za-z_][\w]*)\s*\("),
        re.compile(r"^\s*function\s+([A-Za-z_$][\w$]*)\s*\("),
        re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\("),
        re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*\s*=>"),
    ]

    lines = read_text_lines(path)
    for number, text in lines:
        stripped = text.strip()
        if stripped.startswith(("import ", "from ")) or stripped.startswith("#include"):
            imports += 1
        if stripped.startswith("export "):
            exports += 1
        if len(funcs) >= 12:
            continue
        for pattern in patterns:
            match = pattern.match(text)
            if match:
                funcs.append(f"{match.group(1)}:{number}-{min(number + 40, len(lines))}")
                break

    return {"imports": imports, "exports": exports, "funcs": funcs}
