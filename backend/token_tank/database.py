"""Database setup — SQLite with SQLAlchemy."""

from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import get_settings, ensure_data_dir


def get_engine():
    """Create database engine, ensuring data directory exists."""
    settings = get_settings()
    ensure_data_dir(settings)
    return create_engine(
        f"sqlite:///{settings.db_path}",
        connect_args={"check_same_thread": False},
        echo=False,
    )


def get_session_factory():
    """Create session factory."""
    engine = get_engine()
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


engine = get_engine()
SessionLocal = get_session_factory()
Base = declarative_base()
