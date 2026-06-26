"""Alerts router — CRUD for alert configurations."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import SessionLocal
from ...models import Alert
from ...schemas import AlertCreate, AlertResponse

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/alerts", response_model=list[AlertResponse])
async def list_alerts(db: Session = Depends(get_db)):
    """List all configured alerts."""
    return db.query(Alert).all()


@router.post("/alerts", response_model=AlertResponse, status_code=201)
async def create_alert(payload: AlertCreate, db: Session = Depends(get_db)):
    """Create a new alert."""
    alert = Alert(
        provider_id=payload.provider_id,
        threshold_type=payload.threshold_type,
        threshold_value=payload.threshold_value,
        window=payload.window,
        channel=payload.channel,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/alerts/{alert_id}", status_code=204)
async def delete_alert(alert_id: str, db: Session = Depends(get_db)):
    """Delete an alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
