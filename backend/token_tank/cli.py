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
import logging
import os
import sys

from .config import get_settings, ensure_data_dir


# ── CLI subcommand handlers ───────────────────────────────────────

def _cmd_start(args: argparse.Namespace) -> None:
    """Start proxy + FastAPI (same process)."""
    from .runner import run_all
    import asyncio

    _setup_logging()
    settings = get_settings()
    ensure_data_dir(settings)  # create data dir so PID file + DB writes succeed

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

    async def run_services():
        await run_all(
            settings.proxy_host,
            settings.proxy_port,
            settings.api_host,
            settings.api_port,
        )

    try:
        asyncio.run(run_services())
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
    """Initialize the data directory and default config.

    Writes ``config.toml`` into the configured data dir (honoring
    ``TOKEN_TANK_DATA_DIR``), so init and the loader agree on the path.
    """
    from .config import save_config_file, _toml_path

    settings = get_settings()
    ensure_data_dir(settings)

    config_path = _toml_path()

    if not config_path.exists():
        save_config_file(settings, config_path)

    print(f"✅  Initialized Token Tank at {config_path}")


def _cmd_seed(args: argparse.Namespace) -> None:
    """Populate the database with demo providers and usage data."""
    from .seed import seed_database

    seed_database()


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
    from . import __version__

    parser = argparse.ArgumentParser(
        prog="token-tank",
        description="⛽ Token Tank — local AI usage monitor",
    )
    parser.add_argument(
        "-V", "--version",
        action="version",
        version=f"token-tank {__version__}",
    )
    parser.add_argument(
        "--config",
        metavar="PATH",
        default=None,
        help="Path to a config.toml file (overrides the default location).",
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

    # seed
    subparsers.add_parser("seed", help="Populate demo data (6 providers, 7 days of usage)")

    args = parser.parse_args(argv)

    # --config points the loader (and init) at an explicit config file.
    if getattr(args, "config", None):
        os.environ["TOKEN_TANK_CONFIG_FILE"] = args.config

    if args.command is None:
        # No subcommand — default to 'start' (like `python -m token_tank`)
        _cmd_start(args)
        return

    handlers = {
        "start": _cmd_start,
        "stop": _cmd_stop,
        "status": _cmd_status,
        "init": _cmd_init,
        "seed": _cmd_seed,
    }

    handler = handlers.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
