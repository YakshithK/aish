from __future__ import annotations

import os
from pathlib import Path

from agentshell.fs import IGNORED_NAMES, TREE_MAX_DEPTH, TREE_MAX_FILES
from agentshell.output import CommandResult, csv, join_lines


IMPORTANT_ORDER = [
    "pyproject.toml",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "README.md",
    "src",
    "tests",
]


def run(path: str = ".") -> CommandResult:
    root = Path(path)
    files_seen = 0
    dirs_seen = 0
    omitted: set[str] = set()
    groups: dict[str, list[str]] = {}
    truncated = False

    project = _detect_project(root)
    important = _important(root)

    for current, dirnames, filenames in os.walk(root):
        current_path = Path(current)
        rel = current_path.relative_to(root)
        depth = 0 if rel == Path(".") else len(rel.parts)
        if depth >= TREE_MAX_DEPTH:
            omitted.update(dirnames)
            dirnames[:] = []
        else:
            kept = []
            for name in sorted(dirnames):
                child = current_path / name
                if name in IGNORED_NAMES:
                    omitted.add(name)
                elif child.is_symlink():
                    omitted.add(f"{name}@")
                else:
                    kept.append(name)
                    dirs_seen += 1
            dirnames[:] = kept

        visible_files = []
        for name in sorted(filenames):
            if files_seen >= TREE_MAX_FILES:
                truncated = True
                break
            if name in IGNORED_NAMES:
                omitted.add(name)
                continue
            visible_files.append(name)
            files_seen += 1
        key = "root" if rel == Path(".") else str(rel)
        entries = _ordered(visible_files + dirnames)
        if entries:
            groups[key] = entries[:12]
        if truncated:
            dirnames[:] = []
            break

    lines = [
        f"project={project} files={files_seen} dirs={dirs_seen} important={csv(important)}",
    ]
    lines.extend(f"{name}: {csv(entries)}" for name, entries in sorted(groups.items(), key=_group_sort))
    if omitted or truncated:
        values = sorted(omitted)
        if truncated:
            values.append("max_files")
        lines.append(f"omitted: {csv(values)}")
    return CommandResult(join_lines(lines))


def _detect_project(root: Path) -> str:
    checks = [
        ("python", "pyproject.toml"),
        ("node", "package.json"),
        ("rust", "Cargo.toml"),
        ("go", "go.mod"),
    ]
    for project, filename in checks:
        if (root / filename).exists():
            return project
    return "unknown"


def _important(root: Path) -> list[str]:
    return [name for name in IMPORTANT_ORDER if (root / name).exists()]


def _ordered(entries: list[str]) -> list[str]:
    rank = {name: index for index, name in enumerate(IMPORTANT_ORDER)}
    return sorted(entries, key=lambda item: (rank.get(item, 99), item))


def _group_sort(item: tuple[str, list[str]]) -> tuple[int, str]:
    return (0 if item[0] == "root" else 1, item[0])
