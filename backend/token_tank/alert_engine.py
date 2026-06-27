"""Alert evaluation engine — evaluates thresholds, fires notifications, logs history."""

import os
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Alert, AlertHistory, BillingSnapshot, Provider, UsageRecord


def evaluate_alerts(db: Session) -> list[dict[str, Any]]:
    """Check all enabled alerts against current usage data.

    Returns a list of dicts, one per triggered alert:
        {
            "alert": Alert object,
            "provider_name": str|None,
            "triggered": bool,
            "message": str,  # human-readable detail
        }

    Threshold types:
      - 'percentage': compares burn_rate_tokens_per_hour vs threshold (tokens/hr)
        → fired when burn rate exceeds the threshold as a percentage of provider capacity.
          For now we treat it as: if burn_rate_tokens_per_hour exceeds threshold, fire.
      - 'cost': compares today's cost vs threshold
        → fired when total_cost for today exceeds this value.
      - 'absolute': compares total tokens vs threshold
        → fired when sum(total_tokens) across all time exceeds this value.
    """
    results: list[dict[str, Any]] = []

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    enabled_alerts = db.query(Alert).filter(Alert.enabled == True).all()

    for alert in enabled_alerts:
        triggered = False
        message = ""

        # Resolve provider name for scoped queries (if provider_id is set)
        provider_obj = None
        if alert.provider_id:
            provider_obj = (
                db.query(Provider)
                .filter(Provider.id == alert.provider_id)
                .first()
            )

        if alert.threshold_type == "percentage":
            # Compare burn rate (last hour) against threshold
            hour_ago = now - timedelta(hours=1)

            if provider_obj:
                recent_records = (
                    db.query(UsageRecord)
                    .filter(UsageRecord.provider == provider_obj.provider)
                    .filter(UsageRecord.timestamp >= hour_ago)
                    .all()
                )
            else:
                recent_records = (
                    db.query(UsageRecord)
                    .filter(UsageRecord.timestamp >= hour_ago)
                    .all()
                )

            burn_tokens = sum(r.total_tokens for r in recent_records)
            if burn_tokens >= alert.threshold_value:
                triggered = True
                message = (
                    f"Burn rate {burn_tokens} tokens/hr exceeds "
                    f"{alert.threshold_value:.0f} threshold"
                )

        elif alert.threshold_type == "cost":
            # Compare today's cost vs threshold
            if provider_obj:
                today_records = (
                    db.query(UsageRecord)
                    .filter(UsageRecord.provider == provider_obj.provider)
                    .filter(UsageRecord.timestamp >= today_start)
                    .all()
                )
            else:
                today_records = (
                    db.query(UsageRecord)
                    .filter(UsageRecord.timestamp >= today_start)
                    .all()
                )

            total_cost = sum(r.estimated_cost for r in today_records)
            if total_cost >= alert.threshold_value:
                triggered = True
                message = (
                    f"Today's cost ${total_cost:.4f} exceeds "
                    f"${alert.threshold_value:.2f} threshold"
                )

        elif alert.threshold_type == "absolute":
            # Compare total tokens vs threshold (all time for this provider)
            if provider_obj:
                all_records = (
                    db.query(UsageRecord)
                    .filter(UsageRecord.provider == provider_obj.provider)
                    .all()
                )
            else:
                all_records = db.query(UsageRecord).all()

            total_tokens = sum(r.total_tokens for r in all_records)
            if total_tokens >= alert.threshold_value:
                triggered = True
                message = (
                    f"Total tokens {total_tokens} exceeds "
                    f"{alert.threshold_value:.0f} threshold"
                )

        else:
            message = f"Unknown threshold type: {alert.threshold_type}"

        # Get provider name
        provider_name = None
        if alert.provider_id:
            provider_obj = (
                db.query(Provider)
                .filter(Provider.id == alert.provider_id)
                .first()
            )
            if provider_obj:
                provider_name = provider_obj.display_name

        results.append({
            "alert": alert,
            "provider_name": provider_name,
            "triggered": triggered,
            "message": message,
        })

    return results


def fire_macos_notification(title: str, message: str) -> bool:
    """Fire a macOS notification using osascript.

    Returns True if successful, False otherwise (non-macOS, permission denied, etc).
    """
    if os.name != "posix":
        return False

    try:
        subprocess.run(
            [
                "osascript", "-e",
                f'display notification "{message}" with title "{title}"',
            ],
            capture_output=True,
            timeout=5,
        )
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def check_and_fire(db: Session | None = None) -> list[dict[str, Any]]:
    """Evaluate all enabled alerts, fire notifications, and store history.

    Respects a 15-minute cooldown per alert (prevents duplicate alerts).

    Uses the caller's session if provided, otherwise creates a new one.
    Returns list of triggered alert dicts (same format as evaluate_alerts).
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        results = evaluate_alerts(db)
        triggered_list: list[dict[str, Any]] = []
        now = datetime.now(timezone.utc)
        cooldown_cutoff = now - timedelta(minutes=15)

        for result in results:
            if not result["triggered"]:
                continue

            alert = result["alert"]

            # Check cooldown — last triggered_at for this alert_id
            last_history = (
                db.query(AlertHistory)
                .filter(AlertHistory.alert_id == alert.id)
                .order_by(AlertHistory.triggered_at.desc())
                .first()
            )

            if last_history and last_history.triggered_at:
                # Ensure both are timezone-aware for comparison
                last_ts = last_history.triggered_at
                if last_ts.tzinfo is None:
                    last_ts = last_ts.replace(tzinfo=timezone.utc)
                if last_ts >= cooldown_cutoff:
                    # Still within cooldown — skip
                    continue

            # Fire macOS notification (best-effort)
            fire_macos_notification(
                title=f"Token Tank Alert: {result.get('provider_name') or 'General'}",
                message=result["message"],
            )

            # Store history record
            hist = AlertHistory(
                alert_id=alert.id,
                provider_name=result["provider_name"],
                threshold_type=alert.threshold_type,
                threshold_value=alert.threshold_value,
                message=result["message"],
            )
            db.add(hist)

            triggered_list.append(result | {"history_id": hist.id})

        if triggered_list:
            db.commit()

        return triggered_list
    finally:
        if own_session:
            db.close()
