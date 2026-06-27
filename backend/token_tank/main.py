"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, init_db
from .routers import dashboard, providers, alerts
from .config import get_settings


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
    description="⛽ Local-first AI usage monitor",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(dashboard.router, prefix="/api/v1", tags=["dashboard"])
app.include_router(providers.router, prefix="/api/v1", tags=["providers"])
app.include_router(alerts.router, prefix="/api/v1", tags=["alerts"])


@app.get("/")
async def root():
    return {"name": "Token Tank", "version": "0.2.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
