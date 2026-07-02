"""Quota router — GET endpoints for provider subscription windows."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Provider, QuotaWindow
from ..schemas import QuotaWindowResponse, QuotaWindowsResponse


router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _to_response(qw: QuotaWindow) -> QuotaWindowResponse:
    """Convert ORM to response, computing percentage."""
    percentage = 0.0
    if qw.limit and qw.limit > 0:
        percentage = (qw.used / qw.limit) * 100.0
        percentage = round(min(percentage, 999.0), 2)
    return QuotaWindowResponse(
        id=qw.id,
        provider_id=qw.provider_id,
        window_type=qw.window_type,
        label=qw.label,
        used=qw.used,
        limit=qw.limit,
        unit=qw.unit,
        reset_at=qw.reset_at,
        source=qw.source,
        updated_at=qw.updated_at or datetime.now(timezone.utc),
        percentage=percentage,
    )


@router.get("/quota/{provider_id}", response_model=QuotaWindowsResponse)
async def get_provider_quota(provider_id: str, db: Session = Depends(get_db)):
    """Get all quota windows for a single provider."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    windows = (
        db.query(QuotaWindow)
        .filter(QuotaWindow.provider_id == provider_id)
        .all()
    )

    return QuotaWindowsResponse(
        provider_id=provider.id,
        provider=provider.provider,
        display_name=provider.display_name,
        windows=[_to_response(w) for w in windows],
    )


@router.get("/quota", response_model=list[QuotaWindowsResponse])
async def get_all_quotas(db: Session = Depends(get_db)):
    """Get quota windows for all enabled providers."""
    providers = db.query(Provider).filter(Provider.enabled == True).all()
    results = []

    for provider in providers:
        windows = (
            db.query(QuotaWindow)
            .filter(QuotaWindow.provider_id == provider.id)
            .all()
        )
        results.append(QuotaWindowsResponse(
            provider_id=provider.id,
            provider=provider.provider,
            display_name=provider.display_name,
            windows=[_to_response(w) for w in windows],
        ))

    return results
