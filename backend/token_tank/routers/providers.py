"""Providers router — CRUD for provider connections."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Provider, UsageRecord
from ..schemas import ProviderCreate, ProviderResponse, UsageRecordResponse
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
    return db.query(Provider).all()


@router.post("/providers", response_model=ProviderResponse, status_code=201)
async def create_provider(payload: ProviderCreate, db: Session = Depends(get_db)):
    """Add a new provider connection."""
    provider = Provider(
        provider=payload.provider,
        display_name=payload.display_name,
        api_key_encrypted=encrypt(payload.api_key),
        org_id=payload.org_id,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


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
