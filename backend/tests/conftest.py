"""Test configuration and fixtures."""

import os
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set test data dir BEFORE importing token_tank modules
_test_dir = Path(tempfile.mkdtemp(prefix="token_tank_test_"))
os.environ["TOKEN_TANK_DATA_DIR"] = str(_test_dir)
os.environ["TOKEN_TANK_DB_PATH"] = str(_test_dir / "test.db")


@pytest.fixture(scope="session")
def db_engine():
    """Create a fresh DB engine for the test session."""
    db_path = str(_test_dir / "test.db")
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    from token_tank.database import Base
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    """DB session for proxy/adapter tests — cleaned after each test."""
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    # Clean all data after each test
    from token_tank.models import UsageRecord, Provider, BillingSnapshot, Alert
    session.query(UsageRecord).delete()
    session.query(Alert).delete()
    session.query(BillingSnapshot).delete()
    session.query(Provider).delete()
    session.commit()
    session.close()
