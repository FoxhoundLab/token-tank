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
    api_tier = Column(String, default="plan")  # 'plan' (subscription) | 'pay_as_you_go'
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)

    alerts = relationship("Alert", back_populates="provider_ref")
    quota_windows = relationship("QuotaWindow", back_populates="provider_ref", cascade="all, delete-orphan")


# ── Provider type classification ────────────────────────────────────
# Maps provider name → card model for dashboard rendering.
# 'subscription' = usage windows + countdowns (e.g. Claude Pro, ChatGPT Plus)
# 'api'          = pay-per-token spend tiles + balance
# 'local'        = free, infinite gauge, token count only
PROVIDER_TYPES: dict[str, str] = {
    "anthropic": "subscription",
    "openai": "subscription",
    "zai": "api",
    "minimax": "api",
    "ollama": "local",
    "lmstudio": "local",
}


def get_provider_type(provider_name: str) -> str:
    """Return the card model type for a provider name. Defaults to 'api'."""
    return PROVIDER_TYPES.get(provider_name, "api")


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


class AlertHistory(Base):
    """Record of a triggered alert for history/audit."""

    __tablename__ = "alert_history"

    id = Column(String, primary_key=True, default=_uuid)
    alert_id = Column(String, ForeignKey("alerts.id"), nullable=False)
    provider_name = Column(String)  # Human-readable provider name
    threshold_type = Column(String, nullable=False)  # 'percentage', 'absolute', 'cost'
    threshold_value = Column(Float, nullable=False)
    message = Column(Text, nullable=False)  # Human-readable alert message
    triggered_at = Column(DateTime, default=_now)
    created_at = Column(DateTime, default=_now)


class QuotaWindow(Base):
    """Provider subscription quota window.

    Tracks usage caps per provider per window type:
    - '5h'         (5-hour rolling window)
    - 'weekly'     (weekly reset)
    - 'monthly'    (monthly reset, for some providers)
    - 'model:{id}' (model-specific limit, e.g. 'model:fable-5')

    Data source: Anthropic admin API (real) or browser extension (DOM scrapes
    claude.ai, chatgpt.com, etc.). Updated by the QuotaPoller system.
    """

    __tablename__ = "quota_windows"

    id = Column(String, primary_key=True, default=_uuid)
    provider_id = Column(String, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    window_type = Column(String, nullable=False)  # '5h' | 'weekly' | 'monthly' | 'model:*'
    label = Column(String)  # Human-readable: "5h Session", "Weekly Cap", "Fable 5 model"
    used = Column(Float, nullable=False, default=0.0)  # Tokens or units consumed
    limit = Column(Float, nullable=False, default=0.0)  # Cap
    unit = Column(String, default="tokens")  # 'tokens' | 'requests' | 'credits' | 'usd'
    reset_at = Column(DateTime)  # When this window resets
    source = Column(String, default="api")  # 'api' | 'extension' | 'manual'
    raw_data = Column(Text)  # JSON string of source response for audit
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    provider_ref = relationship("Provider", back_populates="quota_windows")
