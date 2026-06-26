"""Providers router — CRUD for provider connections."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import SessionLocal
from ...models import Provider
from ...schemas import ProviderCreate, ProviderResponse
from ...crypto import encrypt

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
