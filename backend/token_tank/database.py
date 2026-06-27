"""Database setup — SQLite with SQLAlchemy."""

from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import get_settings, ensure_data_dir


def get_engine():
    """Create database engine, ensuring data directory exists."""
    settings = get_settings()
    ensure_data_dir(settings)
    engine = create_engine(
        f"sqlite:///{settings.db_path}",
        connect_args={"check_same_thread": False},
        echo=False,
    )
    # Enable WAL mode for concurrent read/write
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

    return engine


def get_session_factory():
    """Create session factory."""
    engine = get_engine()
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


engine = get_engine()
SessionLocal = get_session_factory()
Base = declarative_base()


def init_db():
    """Create all tables. Called on app startup."""
    import token_tank.models  # noqa: F401 — register models
    Base.metadata.create_all(bind=engine)
