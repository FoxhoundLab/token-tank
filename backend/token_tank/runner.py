"""Async service runners — extracted from __main__.py.

These functions are shared between ``python -m token_tank`` (direct invocation)
and the CLI ``start`` subcommand.

Usage::

    from .runner import run_all, run_proxy, run_fastapi
    await run_all()

"""

import asyncio
import logging
import os
import signal
from pathlib import Path

logger = logging.getLogger("token_tank")


async def run_proxy(proxy_host: str, proxy_port: int) -> None:
    """Run the aiohttp proxy server on *proxy_host*:*proxy_port*."""
    from .proxy.server import create_proxy_app, _on_startup, _on_cleanup
    from aiohttp import web

    app = create_proxy_app()
    logger.info(f"⛓ Proxy starting on {proxy_host}:{proxy_port}")

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host=proxy_host, port=proxy_port)
    await site.start()

    stop_event = asyncio.Event()

    def _handle_signal():
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle_signal)

    await stop_event.wait()
    logger.info("Proxy shutting down…")
    await runner.cleanup()


async def run_fastapi(api_host: str, api_port: int) -> None:
    """Run the FastAPI (uvicorn) server on *api_host*:*api_port*."""
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

    # FIX: server.serve() takes no args — it already handles SIGINT/SIGTERM
    await server.serve()
    logger.info("FastAPI shutting down…")


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


async def run_all(proxy_host: str, proxy_port: int, api_host: str, api_port: int) -> None:
    """Run both proxy and FastAPI services concurrently."""
    logger.info("╔══════════════════════════════════════╗")
    logger.info("║   Token Tank — starting services    ║")
    logger.info(f"╚══════════════════════════════════════╝")

    await asyncio.gather(
        run_proxy(proxy_host, proxy_port),
        run_fastapi(api_host, api_port),
    )
