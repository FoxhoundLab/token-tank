"""FastAPI application entry point."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .database import Base, engine, init_db
from .routers import dashboard, providers, alerts, extension, quota
from .config import get_settings

# Locate the production dashboard build. Prefer the copy bundled inside the
# installed package (token_tank/webui/), falling back to the repo's
# frontend/dist/ for local development from a source checkout.
_PKG_DIR = Path(__file__).resolve().parent
_BUNDLED_UI = _PKG_DIR / "webui"
_REPO_UI = _PKG_DIR.parent.parent / "frontend" / "dist"


def _frontend_dist() -> Path | None:
    """Return the directory holding the built SPA, or None if not present."""
    if _BUNDLED_UI.is_dir():
        return _BUNDLED_UI
    if _REPO_UI.is_dir():
        return _REPO_UI
    return None


def _frontend_dist_exists() -> bool:
    """Return True when a production frontend build exists."""
    return _frontend_dist() is not None


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

    # Start quota poller (subscription cap tracking, every 5 min)
    try:
        from .quota_poller import start_quota_poller
        quota_scheduler = start_quota_poller()
        if quota_scheduler:
            app.state.quota_scheduler = quota_scheduler
    except Exception as e:
        import logging
        logging.getLogger("token_tank").warning(
            f"Quota poller startup failed (non-fatal): {e}"
        )

    yield

    # Shutdown: stop schedulers if running
    scheduler = getattr(app.state, "billing_scheduler", None)
    if scheduler:
        scheduler.shutdown(wait=False)
    quota_scheduler = getattr(app.state, "quota_scheduler", None)
    if quota_scheduler:
        quota_scheduler.shutdown(wait=False)


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
app.include_router(quota.router, prefix="/api/v1", tags=["quota"])


@app.get("/health")
async def health():
    """Liveness probe. Defined before the SPA mount so it isn't shadowed."""
    return {"status": "ok"}

# ── Production frontend serving (Sprint 4A) ───────────────────────
_ui_dir = _frontend_dist()
if _ui_dir is not None:
    from fastapi.staticfiles import StaticFiles

    # Serve static assets (JS/CSS/images under /assets/)
    app.mount("/assets", StaticFiles(directory=str(_ui_dir / "assets")), name="assets")
    # Serve the built SPA (index.html at root, all other paths fallback)
    app.mount("/", StaticFiles(directory=str(_ui_dir), html=True), name="spa")

    async def spa_catch_all(path: str = "/"):
        """Serve index.html for any unmatched SPA route."""
        return FileResponse(str(_ui_dir / "index.html"))

    app.add_api_route("/{path:path}", spa_catch_all, methods=["GET"], include_in_schema=False)
else:
    # Development fallback — JSON root endpoint.
    @app.get("/")
    async def root():
        return {"name": "Token Tank", "version": "0.2.0", "status": "running"}
