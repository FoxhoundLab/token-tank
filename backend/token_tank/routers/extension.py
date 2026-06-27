"""Extension ingestion router — receives data from the Token Tank browser extension."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import UsageRecord


router = APIRouter()


class ExtensionUsagePayload(BaseModel):
    provider: str  # 'claude_web' or 'chatgpt_web'
    data: dict
    timestamp: str


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
    # Estimate token count: rough proxy for subscription usage
    message_count = payload.data.get("message_count") or 0
    rate_limited = 1 if payload.data.get("rate_limited") else 0

    # Use message_count as a token proxy (each message ~1000 tokens)
    estimated_tokens = message_count * 1000

    record = UsageRecord(
        provider=payload.provider,
        model="subscription",
        input_tokens=estimated_tokens,
        output_tokens=0,
        total_tokens=estimated_tokens,
        estimated_cost=0.0,  # Subscription = flat fee, not metered
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
