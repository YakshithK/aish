from __future__ import annotations

import argparse
import os
import sys
import traceback

from .output import AishError, CommandResult, EXIT_RUNTIME


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="aish",
        description="Compact terminal observations for AI coding agents.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    tree = subparsers.add_parser("tree", help="show compact project structure")
    tree.add_argument("path", nargs="?", default=".")
    tree.set_defaults(handler=_run_tree)

    view = subparsers.add_parser("view", help="safely view a file or line range")
    view.add_argument("target")
    view.set_defaults(handler=_run_view)

    search = subparsers.add_parser("search", help="search compactly")
    search.add_argument("query")
    search.add_argument("path", nargs="?", default=".")
    search.set_defaults(handler=_run_search)

    status = subparsers.add_parser("status", help="show compact git status")
    status.add_argument("path", nargs="?", default=".")
    status.set_defaults(handler=_run_status)

    diff = subparsers.add_parser("diff", help="summarize git diffs without dumping full patches")
    diff.add_argument("target", nargs="?", default=None)
    diff.add_argument("--staged", action="store_true", help="show staged changes")
    diff.set_defaults(handler=_run_diff)

    inspect = subparsers.add_parser("inspect", help="summarize repo setup, git state, and project structure")
    inspect.add_argument("path", nargs="?", default=".")
    inspect.set_defaults(handler=_run_inspect)

    init = subparsers.add_parser("init", help="install agent instructions for this repo")
    init.add_argument("path", nargs="?", default=".")
    init.add_argument("--force", action="store_true", help="overwrite existing instruction files")
    init.set_defaults(handler=_run_init)

    doctor = subparsers.add_parser("doctor", help="check AgentShell setup")
    doctor.add_argument("path", nargs="?", default=".")
    doctor.add_argument("--agents", action="store_true", help="include global agent skill/rule install state")
    doctor.set_defaults(handler=_run_doctor)

    install_agent = subparsers.add_parser("install-agent", help="install global AgentShell rules for an agent host")
    install_agent.add_argument("host", choices=["claude", "codex", "cursor", "opencode", "all"])
    install_agent.add_argument("--force", action="store_true", help="overwrite existing global skill/rule files")
    install_agent.set_defaults(handler=_run_install_agent)

    skill = subparsers.add_parser("skill", help="print AgentShell skill/rule content")
    skill_subparsers = skill.add_subparsers(dest="skill_command", required=True)
    skill_print = skill_subparsers.add_parser("print", help="print skill/rule content for manual install")
    skill_print.add_argument("host", choices=["claude", "codex", "cursor", "opencode", "generic"])
    skill_print.set_defaults(handler=_run_skill_print)

    test = subparsers.add_parser("test", help="run and summarize a test command")
    test.add_argument("cmd", nargs=argparse.REMAINDER)
    test.set_defaults(handler=_run_test)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
        result: CommandResult = args.handler(args)
    except AishError as exc:
        print(exc.message, file=sys.stderr)
        return exc.exit_code
    except Exception as exc:  # pragma: no cover - debug branch covered via CLI smoke.
        if os.environ.get("AISH_DEBUG") == "1":
            traceback.print_exc()
        else:
            print(f"error=unexpected detail={type(exc).__name__}: {exc}", file=sys.stderr)
        return EXIT_RUNTIME

    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    return result.exit_code


def _run_tree(args: argparse.Namespace) -> CommandResult:
    from .commands.tree import run

    return run(args.path)


def _run_view(args: argparse.Namespace) -> CommandResult:
    from .commands.view import run

    return run(args.target)


def _run_search(args: argparse.Namespace) -> CommandResult:
    from .commands.search import run

    return run(args.query, args.path)


def _run_status(args: argparse.Namespace) -> CommandResult:
    from .commands.status import run

    return run(args.path)


def _run_diff(args: argparse.Namespace) -> CommandResult:
    from .commands.diff import run

    return run(target=args.target, staged=args.staged)


def _run_inspect(args: argparse.Namespace) -> CommandResult:
    from .commands.inspect import run

    return run(args.path)


def _run_init(args: argparse.Namespace) -> CommandResult:
    from .commands.init import run

    return run(args.path, force=args.force)


def _run_doctor(args: argparse.Namespace) -> CommandResult:
    from .commands.doctor import run

    return run(args.path, agents=args.agents)


def _run_install_agent(args: argparse.Namespace) -> CommandResult:
    from .commands.install_agent import run

    return run(args.host, force=args.force)


def _run_skill_print(args: argparse.Namespace) -> CommandResult:
    from .commands.skill import print_skill

    return print_skill(args.host)


def _run_test(args: argparse.Namespace) -> CommandResult:
    from .commands.test import run

    cmd = args.cmd
    if cmd and cmd[0] == "--":
        cmd = cmd[1:]
    return run(cmd)
