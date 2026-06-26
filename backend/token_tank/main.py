"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import dashboard, providers, alerts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Token Tank",
    description="⛽ Local-first AI usage monitor",
    version="0.1.0",
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
    return {"name": "Token Tank", "version": "0.1.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
