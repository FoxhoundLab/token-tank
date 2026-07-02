"""Providers router — CRUD for provider connections."""

import csv
import io
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Provider, UsageRecord
from ..schemas import (
    DailyTotalResponse,
    ModelBreakdownItem,
    ProviderHistoryResponse,
    ProviderCreate,
    ProviderResponse,
    UsageRecordResponse,
)
from ..crypto import encrypt

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/providers", response_model=list[ProviderResponse])
async def list_providers(db: Session = Depends(get_db)):
    """List all configured providers."""
    from ..models import get_provider_type

    providers = db.query(Provider).all()
    return [
        ProviderResponse(
            id=p.id,
            provider=p.provider,
            display_name=p.display_name,
            org_id=p.org_id,
            api_tier=p.api_tier or "plan",
            enabled=p.enabled,
            created_at=p.created_at,
            provider_type=get_provider_type(p.provider),
        )
        for p in providers
    ]


@router.post("/providers", response_model=ProviderResponse, status_code=201)
async def create_provider(payload: ProviderCreate, db: Session = Depends(get_db)):
    """Add a new provider connection."""
    from ..models import get_provider_type

    provider = Provider(
        provider=payload.provider,
        display_name=payload.display_name,
        api_key_encrypted=encrypt(payload.api_key),
        org_id=payload.org_id,
        api_tier=payload.api_tier,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return ProviderResponse(
        id=provider.id,
        provider=provider.provider,
        display_name=provider.display_name,
        org_id=provider.org_id,
        api_tier=provider.api_tier or "plan",
        enabled=provider.enabled,
        created_at=provider.created_at,
        provider_type=get_provider_type(provider.provider),
    )


@router.delete("/providers/{provider_id}", status_code=204)
async def delete_provider(provider_id: str, db: Session = Depends(get_db)):
    """Disconnect a provider."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(provider)
    db.commit()


@router.get(
    "/providers/{provider_id}/usage",
    response_model=list[UsageRecordResponse],
)
async def get_provider_usage(
    provider_id: str,
    days: Annotated[int, Query(ge=1, le=365)] = 7,
    model: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Get time-series usage records for a provider (for charts).

    Args:
        provider_id: The provider's UUID.
        days: Number of days to look back (default 7, max 365).
        model: Optional filter by model name.

    Returns:
        List of UsageRecordResponse ordered newest first.
    """
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query = (
        db.query(UsageRecord)
        .filter(UsageRecord.provider == provider.provider)
        .filter(UsageRecord.timestamp >= cutoff)
    )

    if model:
        query = query.filter(UsageRecord.model == model)

    records = (
        query.order_by(UsageRecord.timestamp.desc()).all()
    )
    return records


# ── History drill-down endpoint (Sprint 3C) ─────────────────────────────


@router.get(
    "/providers/{provider_id}/history",
    response_model=ProviderHistoryResponse,
)
async def get_provider_history(
    provider_id: str,
    range: Annotated[
        str, Query(pattern="^(7d|30d|90d|all)$", description="Time range")
    ] = "30d",
    db: Session = Depends(get_db),
):
    """Get aggregated daily history for a provider.

    Args:
        provider_id: The provider's UUID.
        range: Time window — '7d', '30d', '90d', or 'all' (default 30d).

    Returns:
        Provider history with daily totals and model breakdown.
    """
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    now = datetime.now(timezone.utc)
    if range == "all":
        cutoff = datetime(now.year - 10, now.month, now.day, tzinfo=timezone.utc)
    else:
        days = int(range[:-1])  # strip trailing 'd'
        cutoff = now - timedelta(days=days)

    records = (
        db.query(UsageRecord)
        .filter(UsageRecord.provider == provider.provider)
        .filter(UsageRecord.timestamp >= cutoff)
        .order_by(UsageRecord.timestamp)
        .all()
    )

    # Build daily totals
    day_map: dict[str, dict] = {}  # date_str -> {total_tokens, total_cost, request_count}
    for r in records:
        date_key = r.timestamp.strftime("%Y-%m-%d")
        if date_key not in day_map:
            day_map[date_key] = {
                "total_tokens": 0,
                "total_cost": 0.0,
                "request_count": 0,
            }
        day_map[date_key]["total_tokens"] += r.total_tokens
        day_map[date_key]["total_cost"] = round(
            day_map[date_key]["total_cost"] + r.estimated_cost, 6
        )
        day_map[date_key]["request_count"] += 1

    daily_totals = [
        DailyTotalResponse(
            date=date_key,
            total_tokens=day["total_tokens"],
            total_cost=round(day["total_cost"], 6),
            request_count=day["request_count"],
        )
        for date_key, day in sorted(day_map.items())
    ]

    # Build model breakdown (across the entire range)
    model_map: dict[str, dict] = {}  # model -> {total_tokens, total_cost}
    for r in records:
        if r.model not in model_map:
            model_map[r.model] = {"total_tokens": 0, "total_cost": 0.0}
        model_map[r.model]["total_tokens"] += r.total_tokens
        model_map[r.model]["total_cost"] = round(
            model_map[r.model]["total_cost"] + r.estimated_cost, 6
        )

    total_tokens_all = sum(m["total_tokens"] for m in model_map.values())
    model_breakdown = [
        ModelBreakdownItem(
            model=model,
            total_tokens=data["total_tokens"],
            total_cost=round(data["total_cost"], 6),
            percentage=(data["total_tokens"] / total_tokens_all * 100)
            if total_tokens_all > 0
            else 0.0,
        )
        for model, data in sorted(
            model_map.items(), key=lambda x: x[1]["total_tokens"], reverse=True
        )
    ]

    return ProviderHistoryResponse(
        provider=provider.provider,
        range=range,
        daily_totals=daily_totals,
        model_breakdown=model_breakdown,
    )


# ── Export endpoint (Sprint 3C) ─────────────────────────────────────────


@router.get("/providers/{provider_id}/export")
async def export_provider_data(
    provider_id: str,
    format: Annotated[str, Query(pattern="^(csv|json)$")] = "csv",
    range: Annotated[str, Query(pattern="^(7d|30d|90d|all)$")] = "30d",
    db: Session = Depends(get_db),
):
    """Export raw usage records for a provider.

    Args:
        provider_id: The provider's UUID.
        format: Output format — 'csv' or 'json' (default csv).
        range: Time window — '7d', '30d', '90d', or 'all'.

    Returns:
        CSV file via StreamingResponse (default) or JSON array.
    """
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    now = datetime.now(timezone.utc)
    if range == "all":
        cutoff = datetime(now.year - 10, now.month, now.day, tzinfo=timezone.utc)
    else:
        days = int(range[:-1])  # strip trailing 'd'
        cutoff = now - timedelta(days=days)

    records = (
        db.query(UsageRecord)
        .filter(UsageRecord.provider == provider.provider)
        .filter(UsageRecord.timestamp >= cutoff)
        .order_by(UsageRecord.timestamp)
        .all()
    )

    if format == "json":
        from ..schemas import UsageRecordResponse as _URR

        return [
            {"provider": r.provider, "model": r.model}
            | {k: getattr(r, k) for k in ("input_tokens", "output_tokens", "total_tokens", "estimated_cost", "timestamp")}
            for r in records
        ]

    # CSV via StreamingResponse
    def generate_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        # Header
        writer.writerow([
            "timestamp",
            "provider",
            "model",
            "input_tokens",
            "output_tokens",
            "total_tokens",
            "estimated_cost",
        ])
        # Rows
        for r in records:
            writer.writerow([
                r.timestamp.isoformat(),
                r.provider,
                r.model,
                r.input_tokens,
                r.output_tokens,
                r.total_tokens,
                r.estimated_cost,
            ])
        yield output.getvalue()

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="export_{provider.provider}_{range}.csv"'
            )
        },
    )
