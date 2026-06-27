"""SQLAlchemy ORM models."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Provider(Base):
    """Configured AI provider connection."""

    __tablename__ = "providers"

    id = Column(String, primary_key=True, default=_uuid)
    provider = Column(String, nullable=False)  # 'anthropic', 'minimax', 'zai', 'ollama', 'lmstudio'
    display_name = Column(String, nullable=False)
    api_key_encrypted = Column(Text)  # Fernet-encrypted
    org_id = Column(String)  # For admin APIs (Anthropic)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)

    alerts = relationship("Alert", back_populates="provider_ref")


class UsageRecord(Base):
    """Per-request usage log from proxy."""

    __tablename__ = "usage_records"

    id = Column(String, primary_key=True, default=_uuid)
    provider = Column(String, nullable=False)
    model = Column(String, nullable=False)
    input_tokens = Column(Integer, nullable=False)
    output_tokens = Column(Integer, nullable=False)
    total_tokens = Column(Integer, nullable=False)
    estimated_cost = Column(Float, nullable=False, default=0.0)
    timestamp = Column(DateTime, default=_now)
    metadata_json = Column(Text)  # JSON string


class BillingSnapshot(Base):
    """Periodic billing data from provider APIs."""

    __tablename__ = "billing_snapshots"

    id = Column(String, primary_key=True, default=_uuid)
    provider = Column(String, nullable=False)  # Provider name string (e.g. 'anthropic')
    provider_id = Column(String, ForeignKey("providers.id"), nullable=True)  # Optional FK
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    total_cost = Column(Float, nullable=False)
    total_tokens = Column(Integer)
    raw_data = Column(Text)  # Full API response for audit
    timestamp = Column(DateTime, default=_now)


class Alert(Base):
    """Alert threshold configuration."""

    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=_uuid)
    provider_id = Column(String, ForeignKey("providers.id"))
    threshold_type = Column(String, nullable=False)  # 'percentage', 'absolute', 'cost'
    threshold_value = Column(Float, nullable=False)
    window = Column(String, default="daily")  # 'daily', 'weekly', 'monthly'
    channel = Column(String, default="notification")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)

    provider_ref = relationship("Provider", back_populates="alerts")
