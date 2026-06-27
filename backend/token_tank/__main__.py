"""Single-command launcher: starts proxy + FastAPI in the same process.

Usage::

    python -m token_tank

Or via CLI subcommand::

    python -m token_tank start
"""

import asyncio
import logging
import os
import signal
import sys
from pathlib import Path

logger = logging.getLogger("token_tank")


def _setup_logging() -> None:
    """Configure root logger for both services."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)-20s] %(levelname)-8s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def _write_pid(settings) -> Path:
    """Write our PID to ~/.token-tank/token-tank.pid."""
    from .config import get_settings, ensure_data_dir

    settings = get_settings()
    ensure_data_dir(settings)
    pid_file = settings.data_dir / "token-tank.pid"
    pid_file.write_text(str(os.getpid()))
    return pid_file


def _read_pid(settings) -> int | None:
    """Read PID from the file, or None if missing/stale."""
    from .config import get_settings

    settings = get_settings()
    pid_file = settings.data_dir / "token-tank.pid"
    if not pid_file.exists():
        return None
    try:
        pid = int(pid_file.read_text().strip())
    except (ValueError, OSError):
        return None
    try:
        os.kill(pid, 0)  # signal 0 = existence check
    except OSError:
        return None  # stale PID file
    return pid


if __name__ == "__main__":
    _setup_logging()

    # Dispatch CLI subcommands when present, otherwise run default launcher.
    if len(sys.argv) > 1 and sys.argv[1] in ("start", "stop", "status", "init"):
        from .cli import main as cli_main

        cli_main(sys.argv[1:])
    else:
        from .config import get_settings
        from .runner import run_all as _run_all

        settings = get_settings()

        _write_pid(settings)

        async def run_all():
            proxy_host = settings.proxy_host
            proxy_port = settings.proxy_port
            api_host = settings.api_host
            api_port = settings.api_port

            await _run_all(proxy_host, proxy_port, api_host, api_port)

        try:
            asyncio.run(run_all())
        except KeyboardInterrupt:
            logger.info("Cancelled by user.")
        finally:
            pid_file = settings.data_dir / "token-tank.pid"
            try:
                pid_file.unlink(missing_ok=True)
            except OSError:
                pass
