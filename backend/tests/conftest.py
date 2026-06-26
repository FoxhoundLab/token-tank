"""Test configuration and fixtures."""

import os
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set test data dir BEFORE importing token_tank modules
_test_dir = tempfile.mkdtemp(prefix="token_tank_test_")
os.environ["TOKEN_TANK_DATA_DIR"] = _test_dir
os.environ["TOKEN_TANK_DB_PATH"] = str(Path(_test_dir) / "test.db")


@pytest.fixture(scope="session")
def db_engine():
    """Create a fresh in-memory-ish DB for the test session."""
    db_path = str(Path(_test_dir) / "test.db")
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    # Import here so env vars are set first
    from token_tank.models import UsageRecord, Provider, BillingSnapshot, Alert
    from token_tank.database import Base

    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Fresh DB session per test — rolled back after."""
    connection = db_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()
