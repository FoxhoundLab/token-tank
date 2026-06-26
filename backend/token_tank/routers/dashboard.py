"""Dashboard router — aggregated usage data."""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import UsageRecord, BillingSnapshot, Provider
from ..schemas import DashboardData, ProviderSummary

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/dashboard", response_model=DashboardData)
async def get_dashboard(db: Session = Depends(get_db)):
    """Get aggregated usage data for all connected providers."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    hour_ago = now - timedelta(hours=1)

    providers = db.query(Provider).filter(Provider.enabled == True).all()
    summaries = []

    for p in providers:
        # Today's usage
        today_records = (
            db.query(UsageRecord)
            .filter(UsageRecord.provider == p.provider)
            .filter(UsageRecord.timestamp >= today_start)
            .all()
        )
        today_tokens = sum(r.total_tokens for r in today_records)
        today_cost = sum(r.estimated_cost for r in today_records)

        # Month's usage
        month_records = (
            db.query(UsageRecord)
            .filter(UsageRecord.provider == p.provider)
            .filter(UsageRecord.timestamp >= month_start)
            .all()
        )
        month_tokens = sum(r.total_tokens for r in month_records)
        month_cost = sum(r.estimated_cost for r in month_records)

        # Burn rate (last hour)
        recent_records = (
            db.query(UsageRecord)
            .filter(UsageRecord.provider == p.provider)
            .filter(UsageRecord.timestamp >= hour_ago)
            .all()
        )
        burn_tokens = sum(r.total_tokens for r in recent_records)
        burn_cost = sum(r.estimated_cost for r in recent_records)

        # Fuel level (placeholder — needs plan limits to be meaningful)
        fuel_level = 1.0  # Default full; will be calculated from caps when available

        summaries.append(
            ProviderSummary(
                provider=p.provider,
                display_name=p.display_name,
                today_tokens=today_tokens,
                today_cost=round(today_cost, 4),
                month_tokens=month_tokens,
                month_cost=round(month_cost, 4),
                burn_rate_tokens_per_hour=burn_tokens,
                burn_rate_cost_per_hour=round(burn_cost, 4),
                fuel_level=fuel_level,
            )
        )

    return DashboardData(providers=summaries)
