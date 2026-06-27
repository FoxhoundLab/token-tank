"""FastAPI application entry point."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .database import Base, engine, init_db
from .routers import dashboard, providers, alerts, extension
from .config import get_settings

# Absolute path to the project root (parent of backend/)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def _frontend_dist_exists() -> bool:
    """Return True when a production frontend build exists."""
    return (_PROJECT_ROOT / "frontend" / "dist").is_dir()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown hooks.

    On startup: create DB tables, start billing pollers.
    On shutdown: scheduler cleanup handled by APScheduler.
    """
    # Create tables on startup
    init_db()

    # Start billing pollers (Sprint 2C)
    try:
        from .proxy.billing_poller import start_billing_pollers
        scheduler = start_billing_pollers()
        if scheduler:
            app.state.billing_scheduler = scheduler
    except Exception as e:
        import logging
        logging.getLogger("token_tank").warning(
            f"Billing poller startup failed (non-fatal): {e}"
        )

    yield

    # Shutdown: stop scheduler if running
    scheduler = getattr(app.state, "billing_scheduler", None)
    if scheduler:
        scheduler.shutdown(wait=False)


settings = get_settings()

app = FastAPI(
    title="Token Tank",
    description="\u26fc Local-first AI usage monitor",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS for frontend dev (dev server on 5173, prod served from 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(dashboard.router, prefix="/api/v1", tags=["dashboard"])
app.include_router(providers.router, prefix="/api/v1", tags=["providers"])
app.include_router(alerts.router, prefix="/api/v1", tags=["alerts"])
app.include_router(extension.router, prefix="/api/v1", tags=["extension"])

# ── Production frontend serving (Sprint 4A) ───────────────────────
_frontend_dist = _PROJECT_ROOT / "frontend" / "dist"
if _frontend_dist_exists():
    from fastapi.staticfiles import StaticFiles

    # Serve static assets (JS/CSS/images under /assets/)
    app.mount("/assets", StaticFiles(directory=str(_frontend_dist / "assets")), name="assets")
    # Serve the built SPA (index.html at root, all other paths fallback)
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="spa")

    async def spa_catch_all(path: str = "/"):
        """Serve index.html for any unmatched SPA route."""
        return FileResponse(str(_frontend_dist / "index.html"))

    app.add_api_route("/{path:path}", spa_catch_all, methods=["GET"], include_in_schema=False)
else:
    # Development fallback — JSON root endpoint.
    @app.get("/")
    async def root():
        return {"name": "Token Tank", "version": "0.2.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
