"""Pydantic schemas for API request/response."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict


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
    provider_type: str = "api"  # 'subscription', 'api', 'local'

    model_config = ConfigDict(from_attributes=True)


# --- Usage ---

class UsageRecordResponse(BaseModel):
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost: float
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardData(BaseModel):
    """Aggregated dashboard response — one entry per provider."""
    providers: list[ProviderSummary]


class ProviderSummary(BaseModel):
    provider: str
    display_name: str
    provider_type: str = "api"  # 'subscription', 'api', 'local'
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

    model_config = ConfigDict(from_attributes=True)


class AlertHistoryResponse(BaseModel):
    id: str
    alert_id: str
    provider_name: str | None
    threshold_type: str
    threshold_value: float
    message: str
    triggered_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- History (Sprint 3C) ---

class DailyTotalResponse(BaseModel):
    date: str          # YYYY-MM-DD
    total_tokens: int
    total_cost: float
    request_count: int


class ModelBreakdownItem(BaseModel):
    model: str
    total_tokens: int
    total_cost: float
    percentage: float  # 0.0 - 100.0


class ProviderHistoryResponse(BaseModel):
    provider: str
    range: str                       # '7d', '30d', '90d', 'all'
    daily_totals: list[DailyTotalResponse]
    model_breakdown: list[ModelBreakdownItem]


# --- Comparison (Sprint 3C) ---

class ProviderComparison(BaseModel):
    provider: str
    display_name: str
    total_tokens_30d: int
    total_cost_30d: float
    request_count_30d: int
