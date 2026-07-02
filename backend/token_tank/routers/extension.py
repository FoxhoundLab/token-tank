"""Extension ingestion router — receives data from the Token Tank browser extension."""

import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Provider, QuotaWindow, UsageRecord


router = APIRouter()


class ExtensionUsagePayload(BaseModel):
    provider: str  # 'claude_web' or 'chatgpt_web'
    data: dict
    timestamp: str


class ExtensionQuotaPayload(BaseModel):
    """Quota data scraped from a provider's web dashboard."""
    provider: str  # 'claude_web' | 'chatgpt_web' | 'zai_web' | 'minimax_web' | 'ollama_web'
    windows: list[dict]  # [{window_type, label, used, limit, unit, reset_at}]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/extension/usage")
async def ingest_extension_usage(payload: ExtensionUsagePayload, db: Session = Depends(get_db)):
    """Receive subscription cap data from the browser extension.

    Records the data as a UsageRecord with provider='claude_web' or 'chatgpt_web'.
    """
    message_count = payload.data.get("message_count") or 0
    rate_limited = 1 if payload.data.get("rate_limited") else 0
    estimated_tokens = message_count * 1000

    record = UsageRecord(
        provider=payload.provider,
        model="subscription",
        input_tokens=estimated_tokens,
        output_tokens=0,
        total_tokens=estimated_tokens,
        estimated_cost=0.0,
        timestamp=datetime.now(timezone.utc),
        metadata_json=str({
            "source": "browser_extension",
            "rate_limited": bool(rate_limited),
            "limit_message": payload.data.get("limit_message"),
            "raw_timestamp": payload.timestamp,
        }),
    )
    db.add(record)
    db.commit()

    return {
        "status": "ingested",
        "provider": payload.provider,
        "estimated_tokens": estimated_tokens,
    }


@router.post("/extension/quota")
async def ingest_extension_quota(payload: ExtensionQuotaPayload, db: Session = Depends(get_db)):
    """Receive quota data scraped from a provider's web dashboard.

    Maps the extension provider name to our internal provider. Updates
    QuotaWindow rows with source='extension'.
    """
    # Map extension provider names to internal ones
    # claude_web → anthropic, chatgpt_web → openai, etc.
    provider_map = {
        "claude_web": "anthropic",
        "chatgpt_web": "openai",
        "zai_web": "zai",
        "minimax_web": "minimax",
        "ollama_web": "ollama",
    }
    internal_provider = provider_map.get(payload.provider)
    if not internal_provider:
        raise HTTPException(status_code=400, detail=f"Unknown extension provider: {payload.provider}")

    provider = db.query(Provider).filter(Provider.provider == internal_provider).first()
    if not provider:
        raise HTTPException(status_code=404, detail=f"Provider {internal_provider} not configured")

    from ..models import _uuid
    from sqlalchemy import delete

    # Replace existing extension-sourced windows for this provider
    db.execute(
        delete(QuotaWindow).where(
            QuotaWindow.provider_id == provider.id,
            QuotaWindow.source == "extension",
        )
    )

    inserted = 0
    for w in payload.windows:
        reset_at = w.get("reset_at")
        if isinstance(reset_at, str):
            try:
                reset_at = datetime.fromisoformat(reset_at.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                reset_at = None

        qw = QuotaWindow(
            id=_uuid(),
            provider_id=provider.id,
            window_type=w.get("window_type", "5h"),
            label=w.get("label"),
            used=float(w.get("used", 0)),
            limit=float(w.get("limit", 0)),
            unit=w.get("unit", "tokens"),
            reset_at=reset_at,
            source="extension",
            raw_data=json.dumps(w) if w else None,
        )
        db.add(qw)
        inserted += 1

    db.commit()

    return {
        "status": "ingested",
        "provider": internal_provider,
        "windows": inserted,
    }
