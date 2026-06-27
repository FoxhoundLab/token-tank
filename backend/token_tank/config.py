"""Application configuration."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Server
    api_host: str = "127.0.0.1"
    api_port: int = 8000

    # Proxy
    proxy_host: str = "127.0.0.1"
    proxy_port: int = 8848

    # Database
    data_dir: Path = Path.home() / ".token-tank"
    db_path: Path = data_dir / "usage.db"

    # Crypto
    secret_key: str = os.environ.get(
        "TOKEN_TANK_SECRET",
        default="",  # Generated on first run if empty
    )

    # Polling
    billing_poll_interval: int = 300  # seconds (5 min)

    # Data retention
    retention_days: int = 90

    # CORS origins (frontend dev server)
    cors_origins: list[str] = ["http://localhost:5173"]

    class Config:
        env_prefix = "TOKEN_TANK_"
        env_file = ".env"


def get_settings() -> Settings:
    """Get application settings (creates new instance each call)."""
    return Settings()


def ensure_data_dir(settings: Settings) -> None:
    """Create data directory on first run."""
    settings.data_dir.mkdir(parents=True, exist_ok=True)
