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


async def _run_proxy_async(proxy_host: str, proxy_port: int) -> None:
    """Run the aiohttp proxy server in an async task."""
    from .proxy.server import create_proxy_app, _on_startup, _on_cleanup
    from aiohttp import web

    app = create_proxy_app()
    logger.info(f"⛓ Proxy starting on {proxy_host}:{proxy_port}")

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host=proxy_host, port=proxy_port)
    await site.start()

    # Wait until cancelled (e.g. SIGINT/SIGTERM)
    stop_event = asyncio.Event()

    def _handle_signal():
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle_signal)

    await stop_event.wait()
    logger.info("Proxy shutting down…")
    await runner.cleanup()


async def _run_fastapi_async(api_host: str, api_port: int) -> None:
    """Run the FastAPI (uvicorn) server in an async task."""
    import uvicorn

    from .main import app

    logger.info(f"🔧 FastAPI starting on {api_host}:{api_port}")
    config = uvicorn.Config(
        app,
        host=api_host,
        port=api_port,
        log_level="info",
        access_log=False,  # We use our own logger
    )
    server = uvicorn.Server(config)

    stop_event = asyncio.Event()

    def _handle_signal():
        stop_event.set()
        server.should_exit = True  # uvicorn flag

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle_signal)

    await server.serve(stop_event)
    logger.info("FastAPI shutting down…")


def _write_pid() -> Path:
    """Write our PID to ~/.token-tank/token-tank.pid."""
    from .config import get_settings, ensure_data_dir

    settings = get_settings()
    ensure_data_dir(settings)
    pid_file = settings.data_dir / "token-tank.pid"
    pid_file.write_text(str(os.getpid()))
    return pid_file


def _read_pid() -> int | None:
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
    # Check if process is actually running
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

        settings = get_settings()

        _write_pid()

        async def run_all():
            proxy_host = settings.proxy_host
            proxy_port = settings.proxy_port
            api_host = settings.api_host
            api_port = settings.api_port

            logger.info("╔══════════════════════════════════════╗")
            logger.info("║   Token Tank — starting services    ║")
            logger.info(f"╚══════════════════════════════════════╝")

            await asyncio.gather(
                _run_proxy_async(proxy_host, proxy_port),
                _run_fastapi_async(api_host, api_port),
            )

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
