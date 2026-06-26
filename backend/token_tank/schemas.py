"""Pydantic schemas for API request/response."""

from datetime import datetime
from pydantic import BaseModel


# --- Provider ---

class ProviderCreate(BaseModel):
    provider: str
    display_name: str
    api_key: str
    org_id: str | None = None


class ProviderResponse(BaseModel):
    id: str
    provider: str
    display_name: str
    org_id: str | None
    enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Usage ---

class UsageRecordResponse(BaseModel):
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost: float
    timestamp: datetime


class DashboardData(BaseModel):
    """Aggregated dashboard response — one entry per provider."""
    providers: list[ProviderSummary]


class ProviderSummary(BaseModel):
    provider: str
    display_name: str
    today_tokens: int
    today_cost: float
    month_tokens: int
    month_cost: float
    burn_rate_tokens_per_hour: float
    burn_rate_cost_per_hour: float
    fuel_level: float  # 0.0 (empty) to 1.0 (full) — estimated


# --- Alert ---

class AlertCreate(BaseModel):
    provider_id: str | None = None
    threshold_type: str  # 'percentage', 'absolute', 'cost'
    threshold_value: float
    window: str = "daily"
    channel: str = "notification"


class AlertResponse(BaseModel):
    id: str
    provider_id: str | None
    threshold_type: str
    threshold_value: float
    window: str
    channel: str
    enabled: bool

    class Config:
        from_attributes = True
