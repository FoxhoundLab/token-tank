"""Command-line interface for Token Tank.

Usage::

    python -m token_tank           # starts proxy + FastAPI
    python -c "import token_tank.cli; token_tank.cli.main()"  # or import as module

Subcommands:
    start — Start proxy (8848) + FastAPI (8000).
    stop  — Stop running instance by reading PID file.
    status — Check if Token Tank is currently running.
    init  — Create ~/.token-tank/ with default config.

Examples::

    python -m token_tank start
    python -m token_tank status
"""

import argparse
import os
import sys

from .config import get_settings, ensure_data_dir


# ── CLI subcommand handlers ───────────────────────────────────────

def _cmd_start(args: argparse.Namespace) -> None:
    """Start proxy + FastAPI (same process)."""
    from . import _run_proxy_async, _run_fastapi_async  # noqa: F401
    import asyncio
    import logging

    _setup_logging()
    settings = get_settings()

    pid_file = settings.data_dir / "token-tank.pid"
    existing_pid = _read_existing_pid()
    if existing_pid is not None:
        print(f"⚠  Token Tank already running (PID {existing_pid}). Use 'status' or 'stop' first.")
        sys.exit(1)

    try:
        pid_file.write_text(str(os.getpid()))
    except OSError as exc:
        print(f"❌  Could not write PID file: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"⛽ Starting Token Tank (proxy :{settings.proxy_port}, API :{settings.api_port})…")

    async def run_all():
        await asyncio.gather(
            _run_proxy_async(settings.proxy_host, settings.proxy_port),
            _run_fastapi_async(settings.api_host, settings.api_port),
        )

    try:
        asyncio.run(run_all())
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("\n👋  Stopped by user.")
    finally:
        try:
            pid_file.unlink(missing_ok=True)
        except OSError:
            pass


def _cmd_stop(args: argparse.Namespace) -> None:
    """Stop a running instance."""
    settings = get_settings()
    pid_file = settings.data_dir / "token-tank.pid"

    if not pid_file.exists():
        print("ℹ  Token Tank is not running (no PID file found).")
        return

    pid = _read_existing_pid()
    if pid is None:
        print("ℹ  PID file found but process is gone. Cleaned up.")
        pid_file.unlink(missing_ok=True)
        return

    print(f"⛽ Stopping Token Tank (PID {pid})…")
    try:
        os.kill(pid, 15)  # SIGTERM
        print(f"✅  Token Tank stopped (sent SIGTERM to {pid}).")
    except ProcessLookupError:
        print(f"ℹ  PID {pid} no longer exists. Cleaned up.")
    except PermissionError:
        print(f"❌  Permission denied to send SIGTERM to {pid}.", file=sys.stderr)
        sys.exit(1)
    finally:
        try:
            pid_file.unlink(missing_ok=True)
        except OSError:
            pass


def _cmd_status(args: argparse.Namespace) -> None:
    """Check if Token Tank is running."""
    settings = get_settings()
    pid_file = settings.data_dir / "token-tank.pid"

    if not pid_file.exists():
        print("❌  Token Tank is NOT running.")
        return

    pid = _read_existing_pid()
    if pid is not None:
        print(f"✅  Token Tank IS running (PID {pid}).")
    else:
        print("⚠  Stale PID file found (process not running). Run 'stop' to clean up.")


def _cmd_init(args: argparse.Namespace) -> None:
    """Initialize ~/.token-tank/ directory and default config."""
    settings = get_settings()
    ensure_data_dir(settings)

    # Write a minimal default config if it doesn't exist.
    config_file = settings.data_dir / "config.json"
    if not config_file.exists():
        import json

        default_config = {
            "api_host": settings.api_host,
            "api_port": settings.api_port,
            "proxy_host": settings.proxy_host,
            "proxy_port": settings.proxy_port,
        }
        config_file.write_text(json.dumps(default_config, indent=2))

    print(f"✅  Initialized Token Tank directory at {settings.data_dir}")


# ── Helpers ───────────────────────────────────────────────────────

def _read_existing_pid() -> int | None:
    """Read and validate the current PID file."""
    settings = get_settings()
    pid_file = settings.data_dir / "token-tank.pid"

    if not pid_file.exists():
        return None

    try:
        pid = int(pid_file.read_text().strip())
    except (ValueError, OSError):
        return None

    try:
        os.kill(pid, 0)
    except OSError:
        return None

    return pid


def _setup_logging() -> None:
    """Configure root logger for CLI output."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)-20s] %(levelname)-8s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


# ── Argument parser / entry point ────────────────────────────────

def main(argv: list[str] | None = None) -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="token_tank",
        description="⛽ Token Tank — local AI usage monitor (v0.2.0)",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # start
    subparsers.add_parser("start", help="Start proxy (8848) + FastAPI (8000)")

    # stop
    subparsers.add_parser("stop", help="Stop the running Token Tank instance")

    # status
    subparsers.add_parser("status", help="Check if Token Tank is running")

    # init
    subparsers.add_parser("init", help="Create ~/.token-tank/ with default config")

    args = parser.parse_args(argv)

    if args.command is None:
        # No subcommand — default to 'start' (like `python -m token_tank`)
        _cmd_start(args)
        return

    handlers = {
        "start": _cmd_start,
        "stop": _cmd_stop,
        "status": _cmd_status,
        "init": _cmd_init,
    }

    handler = handlers.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
