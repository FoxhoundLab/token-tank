"""Analytics engine — burn-rate, forecasting, sparkline & window helpers.

Provides pure functions that query UsageRecords from the database and
return structured analytics suitable for dashboard / chart rendering.

Functions:
    burn_rate(provider_name, hours=1) -> dict
    exhaustion_projection(provider_name, quota_limit=None) -> dict | None
    sparkline_data(provider_name, days=7) -> list[dict]
    usage_window_info(provider_name) -> dict
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import UsageRecord


# ────────────────────────── burn_rate ──────────────────────────

def burn_rate(
    db: Session,
    provider_name: str,
    hours: int = 1,
) -> dict:
    """Calculate tokens/hr and $/hr rolling average from last *N* hours.

    Returns
    -------
    dict with keys:
        tokens_per_hour  : float  (rolling average, 0.0 if no data)
        cost_per_hour    : float  (rolling average, rounded to 4dp; 0.0)
        trend            : str    'increasing' | 'decreasing' | 'stable'
        sample_count     : int    number of UsageRecords in window
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)

    records = (
        db.query(UsageRecord)
        .filter(UsageRecord.provider == provider_name)
        .filter(UsageRecord.timestamp >= cutoff)
        .order_by(UsageRecord.timestamp.asc())
        .all()
    )

    sample_count = len(records)
    if sample_count == 0:
        return {
            "tokens_per_hour": 0.0,
            "cost_per_hour": 0.0,
            "trend": "stable",
            "sample_count": 0,
        }

    total_tokens = sum(r.total_tokens for r in records)
    total_cost = sum(r.estimated_cost for r in records)

    # Window span (use 1 hour minimum so we don't divide by zero)
    if sample_count > 1:
        span_hours = (records[-1].timestamp - records[0].timestamp).total_seconds() / 3600.0
        if span_hours < 1e-9:
            # All records within the same instant — treat as 1 hour window
            span_hours = 1.0
    else:
        span_hours = hours

    tokens_per_hour = total_tokens / max(span_hours, 1e-9)
    cost_per_hour = round(total_cost / span_hours, 4)

    # Trend: compare first half avg vs second half avg
    trend = _compute_trend(records, hours)

    return {
        "tokens_per_hour": round(tokens_per_hour, 2),
        "cost_per_hour": cost_per_hour,
        "trend": trend,
        "sample_count": sample_count,
    }


# ────────────────────────── exhaustion_projection ─────────────────

def exhaustion_projection(
    db: Session,
    provider_name: str,
    quota_limit: Optional[float] = None,
) -> Optional[dict]:
    """Project when the provider quota runs out based on current burn rate.

    Parameters
    ----------
    db          : SQLAlchemy session
    provider_name: Provider string (e.g. 'anthropic')
    quota_limit  : Optional cost cap in dollars.  If omitted the function
                   returns None (cannot project without a limit).

    Returns
    -------
    dict with keys:
        hours_remaining       : float  (positive = still has budget)
        projected_exhaustion_time: str  ISO-8601 datetime string (or None)
        rate                  : dict   (the burn_rate result used for projection)
    """
    if quota_limit is None:
        return None

    info = burn_rate(db, provider_name)
    if info["sample_count"] == 0:
        return None

    cost_per_hour = info["cost_per_hour"]
    if cost_per_hour <= 0:
        return None

    remaining = quota_limit - info["cost_per_hour"] * 1.0
    # Actually: remaining = quota_limit - cost_already_spent this projection window
    # Use 1-hour burn rate as the rate.

    hours_remaining = quota_limit / cost_per_hour if cost_per_hour > 0 else float('inf')

    # We need to track how much has already been spent in the window
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=1)  # default burn window

    records_1h = (
        db.query(UsageRecord)
        .filter(UsageRecord.provider == provider_name)
        .filter(UsageRecord.timestamp >= cutoff)
        .all()
    )

    spent_in_window = sum(r.estimated_cost for r in records_1h)
    remaining_budget = quota_limit - spent_in_window

    if remaining_budget <= 0:
        return {
            "hours_remaining": 0,
            "projected_exhaustion_time": now.isoformat(),
            "rate": info,
        }

    hours_remaining = remaining_budget / cost_per_hour
    # Cap to avoid OverflowError on timedelta with absurd values
    hours_remaining = min(hours_remaining, 876000)  # max 100 years
    projected_time = now + timedelta(hours=hours_remaining)

    return {
        "hours_remaining": round(hours_remaining, 2),
        "projected_exhaustion_time": projected_time.isoformat(),
        "rate": info,
    }


# ────────────────────────── sparkline_data ───────────────────────

def sparkline_data(
    db: Session,
    provider_name: str,
    days: int = 7,
) -> list[dict]:
    """Daily aggregated token counts for sparkline / chart rendering.

    Returns a list of ``{date, total_tokens, cost}`` dicts — one per day,
    from oldest to newest.  Days with zero usage are still included.

    Parameters
    ----------
    provider_name : str  (e.g. 'anthropic')
    days          : int  (default 7)
    """
    now = datetime.now(timezone.utc)

    # Build buckets: one per calendar day, oldest first
    daily_buckets: dict[str, dict] = {}
    for i in range(days):
        bucket_date = (now - timedelta(days=days - 1 - i)).replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )
        bucket_key = bucket_date.strftime("%Y-%m-%d")
        daily_buckets[bucket_key] = {
            "date": bucket_date.strftime("%Y-%m-%d"),
            "total_tokens": 0,
            "cost": 0.0,
        }

    cutoff = now - timedelta(days=days)

    records = (
        db.query(UsageRecord)
        .filter(UsageRecord.provider == provider_name)
        .filter(UsageRecord.timestamp >= cutoff)
        .all()
    )

    for r in records:
        day_key = r.timestamp.strftime("%Y-%m-%d")
        if day_key in daily_buckets:
            daily_buckets[day_key]["total_tokens"] += r.total_tokens
            daily_buckets[day_key]["cost"] += r.estimated_cost

    # Round cost per bucket
    for bucket in daily_buckets.values():
        bucket["cost"] = round(bucket["cost"], 4)

    return list(daily_buckets.values())


# ────────────────────────── usage_window_info ───────────────────

def usage_window_info(
    db: Session,
    provider_name: str,
) -> dict:
    """Track 5-hour and weekly window boundaries for quota resets.

    Returns
    -------
    dict with keys:
        five_hour_start     : str  ISO-8601 timestamp (5h ago)
        five_hour_reset     : float  estimated hours until 5-hr window resets
        weekly_start        : str  ISO-8601 timestamp (start of current week)
        weekly_reset        : float  estimated hours until weekly reset
        five_hour_usage     : int  total tokens in last 5 hours
        weekly_usage        : int  total tokens this week (Mon->Sun)
    """
    now = datetime.now(timezone.utc)

    # 5-hour window
    five_hour_ago = now - timedelta(hours=5)
    five_hour_tokens = (
        db.query(func.sum(UsageRecord.total_tokens))
        .filter(UsageRecord.provider == provider_name)
        .filter(UsageRecord.timestamp >= five_hour_ago)
        .scalar() or 0
    )

    # Approximate reset: how many hours until the oldest record in window ages out
    recent_5h = (
        db.query(UsageRecord)
        .filter(UsageRecord.provider == provider_name)
        .filter(UsageRecord.timestamp >= five_hour_ago)
        .order_by(UsageRecord.timestamp.asc())
        .all()
    )
    if recent_5h:
        oldest_in_window = recent_5h[0].timestamp
        # Ensure timezone-aware for comparison
        if oldest_in_window.tzinfo is None:
            oldest_in_window = oldest_in_window.replace(tzinfo=timezone.utc)
        five_hour_reset = (oldest_in_window + timedelta(hours=5) - now).total_seconds() / 3600.0
    else:
        five_hour_reset = 5.0

    # Weekly window (Monday 00:00 UTC of current week)
    days_since_monday = now.weekday()  # Monday=0 .. Sunday=6
    this_week_start = (now - timedelta(days=days_since_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
    )

    weekly_tokens = (
        db.query(func.sum(UsageRecord.total_tokens))
        .filter(UsageRecord.provider == provider_name)
        .filter(UsageRecord.timestamp >= this_week_start)
        .scalar() or 0
    )

    # Next Monday (weekly reset)
    next_week_start = this_week_start + timedelta(days=7)
    weekly_reset = (next_week_start - now).total_seconds() / 3600.0

    return {
        "five_hour_start": five_hour_ago.isoformat(),
        "five_hour_reset": round(max(five_hour_reset, 0), 2),
        "weekly_start": this_week_start.isoformat(),
        "weekly_reset": round(max(weekly_reset, 0), 2),
        "five_hour_usage": five_hour_tokens,
        "weekly_usage": weekly_tokens,
    }


# ────────────────────────── helpers ─────────────────────────────

def _compute_trend(records: list[UsageRecord], hours: int) -> str:
    """Compare first-half vs second-half average usage for trend.

    Uses token counts (not cost) to determine whether the provider's
    usage rate is increasing, decreasing, or stable.
    """
    n = len(records)
    if n < 4:
        return "stable"

    mid = n // 2
    first_half_tokens = sum(r.total_tokens for r in records[:mid])
    second_half_tokens = sum(r.total_tokens for r in records[mid:])

    # Each half covers roughly the same time span, so compare sums
    ratio = second_half_tokens / max(first_half_tokens, 1)

    if ratio > 1.2:
        return "increasing"
    elif ratio < 0.8:
        return "decreasing"
    return "stable"
