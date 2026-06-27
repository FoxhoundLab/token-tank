"""Async service runners — extracted from __main__.py.

These functions are shared between ``python -m token_tank`` (direct invocation)
and the CLI ``start`` subcommand.

Shutdown is coordinated through a single :class:`asyncio.Event`: ``run_all``
installs one set of SIGINT/SIGTERM handlers and passes the event to both
services, so a single signal cleanly stops the proxy *and* FastAPI. (Letting
each service register its own ``loop.add_signal_handler`` does not work — only
the last registration per signal survives, leaving one service hung.)

Usage::

    from .runner import run_all
    await run_all(proxy_host, proxy_port, api_host, api_port)

"""

import asyncio
import logging
import os
import signal
from pathlib import Path

logger = logging.getLogger("token_tank")


async def run_proxy(
    proxy_host: str,
    proxy_port: int,
    stop_event: "asyncio.Event | None" = None,
) -> None:
    """Run the aiohttp proxy server until *stop_event* is set.

    When called standalone (no *stop_event*), it installs its own SIGINT/SIGTERM
    handlers so the proxy can be run on its own.
    """
    from .proxy.server import create_proxy_app
    from aiohttp import web

    app = create_proxy_app()
    logger.info(f"⛓ Proxy starting on {proxy_host}:{proxy_port}")

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host=proxy_host, port=proxy_port)
    await site.start()

    owns_signals = stop_event is None
    if stop_event is None:
        stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, stop_event.set)

    try:
        await stop_event.wait()
    finally:
        logger.info("Proxy shutting down…")
        await runner.cleanup()


async def run_fastapi(
    api_host: str,
    api_port: int,
    stop_event: "asyncio.Event | None" = None,
) -> None:
    """Run the FastAPI (uvicorn) server until *stop_event* is set.

    uvicorn's own signal handlers are disabled so they don't clobber the
    shared handlers installed by :func:`run_all`; shutdown is driven by
    ``server.should_exit``.
    """
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
    # Don't let uvicorn install signal handlers — run_all owns them.
    server.install_signal_handlers = lambda: None

    owns_signals = stop_event is None
    if stop_event is None:
        stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, stop_event.set)

    serve_task = asyncio.create_task(server.serve())
    try:
        await stop_event.wait()
    finally:
        logger.info("FastAPI shutting down…")
        server.should_exit = True
        await serve_task


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
    """Run both proxy and FastAPI services concurrently with one shutdown path."""
    logger.info("╔══════════════════════════════════════╗")
    logger.info("║   Token Tank — starting services    ║")
    logger.info("╚══════════════════════════════════════╝")

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            # Signal handlers may be unavailable (e.g. non-main thread / Windows).
            pass

    await asyncio.gather(
        run_proxy(proxy_host, proxy_port, stop_event),
        run_fastapi(api_host, api_port, stop_event),
    )
