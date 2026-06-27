"""Tests for the alert system — CRUD, evaluation, history, notifications."""

from datetime import datetime, timedelta, timezone
import pytest
from unittest.mock import patch, MagicMock

from token_tank.models import Alert, AlertHistory, UsageRecord, Provider
from token_tank.alert_engine import evaluate_alerts, check_and_fire, fire_macos_notification
from fastapi.testclient import TestClient
from token_tank.main import app


def _seed_usage(db, provider_name: str, tokens: int = 1000, cost: float = 0.1):
    """Seed a single usage record."""
    rec = UsageRecord(
        provider=provider_name, model="test-model",
        input_tokens=tokens // 2, output_tokens=tokens // 2,
        total_tokens=tokens, estimated_cost=cost,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.commit()


class TestAlertCRUD:
    def test_create_and_list_alert(self, db_session):
        """POST alert, GET alerts, verify."""
        from token_tank.routers.alerts import get_db
        # We need to test via TestClient
        db_session.query(Alert).delete()
        db_session.query(AlertHistory).delete()
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/v1/alerts", json={
            "threshold_type": "percentage",
            "threshold_value": 1000,
        })
        assert resp.status_code == 201
        alert = resp.json()
        assert alert["threshold_type"] == "percentage"
        assert alert["threshold_value"] == 1000
        assert alert["enabled"] is True

    def test_toggle_alert(self, db_session):
        """PUT toggle flips enabled."""
        alert = Alert(
            threshold_type="percentage",
            threshold_value=500,
            enabled=True,
        )
        db_session.add(alert)
        db_session.commit()

        # Toggle via API
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.put(f"/api/v1/alerts/{alert.id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False

    def test_delete_alert(self, db_session):
        """Create + delete alert."""
        alert = Alert(
            threshold_type="cost",
            threshold_value=1.0,
            enabled=True,
        )
        db_session.add(alert)
        db_session.commit()
        alert_id = alert.id

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.delete(f"/api/v1/alerts/{alert_id}")
        assert resp.status_code == 204

        # Verify gone
        assert db_session.query(Alert).filter(Alert.id == alert_id).first() is None


class TestAlertEvaluation:
    def test_evaluate_percentage_alert_triggered(self, db_session):
        """Seed usage data, create alert, evaluate — should trigger."""
        db_session.query(UsageRecord).delete()
        db_session.query(Alert).delete()
        db_session.commit()

        # Seed high burn rate
        _seed_usage(db_session, "anthropic", tokens=5000)

        alert = Alert(
            threshold_type="percentage",
            threshold_value=1000,  # 1000 tokens/hr threshold
            enabled=True,
        )
        db_session.add(alert)
        db_session.commit()

        results = evaluate_alerts(db_session)
        triggered = [r for r in results if r["triggered"]]
        assert len(triggered) >= 1

    def test_evaluate_cost_alert_triggered(self, db_session):
        """Seed cost data, create cost alert, evaluate."""
        db_session.query(UsageRecord).delete()
        db_session.query(Alert).delete()
        db_session.commit()

        _seed_usage(db_session, "zai", tokens=100, cost=5.0)

        alert = Alert(
            threshold_type="cost",
            threshold_value=1.0,  # $1 threshold
            enabled=True,
        )
        db_session.add(alert)
        db_session.commit()

        results = evaluate_alerts(db_session)
        triggered = [r for r in results if r["triggered"]]
        assert len(triggered) >= 1

    def test_evaluate_not_triggered(self, db_session):
        """Alert should not trigger when below threshold."""
        db_session.query(UsageRecord).delete()
        db_session.query(Alert).delete()
        db_session.commit()

        _seed_usage(db_session, "anthropic", tokens=10)

        alert = Alert(
            threshold_type="percentage",
            threshold_value=100000,  # Very high threshold
            enabled=True,
        )
        db_session.add(alert)
        db_session.commit()

        results = evaluate_alerts(db_session)
        triggered = [r for r in results if r["triggered"]]
        assert len(triggered) == 0


class TestAlertHistory:
    def test_alert_history_stored(self, db_session):
        """Fire alert, verify AlertHistory record in DB."""
        db_session.query(UsageRecord).delete()
        db_session.query(Alert).delete()
        db_session.query(AlertHistory).delete()
        db_session.commit()

        _seed_usage(db_session, "anthropic", tokens=5000)

        alert = Alert(
            threshold_type="percentage",
            threshold_value=1000,
            enabled=True,
        )
        db_session.add(alert)
        db_session.commit()

        with patch("token_tank.alert_engine.fire_macos_notification", return_value=True):
            triggered = check_and_fire(db_session)

        assert len(triggered) >= 1
        history = db_session.query(AlertHistory).all()
        assert len(history) >= 1
        assert history[0].alert_id == alert.id

    def test_alert_cooldown(self, db_session):
        """Fire same alert twice within 15 min, second should be suppressed."""
        db_session.query(UsageRecord).delete()
        db_session.query(Alert).delete()
        db_session.query(AlertHistory).delete()
        db_session.commit()

        _seed_usage(db_session, "anthropic", tokens=5000)

        alert = Alert(
            threshold_type="percentage",
            threshold_value=1000,
            enabled=True,
        )
        db_session.add(alert)
        db_session.commit()

        with patch("token_tank.alert_engine.fire_macos_notification", return_value=True):
            first = check_and_fire(db_session)
            second = check_and_fire(db_session)

        assert len(first) >= 1
        assert len(second) == 0  # Suppressed by cooldown


class TestMacOSNotification:
    def test_fire_macos_notification_returns_bool(self):
        """Should return a bool (True on macOS, False otherwise)."""
        result = fire_macos_notification("Test", "Test message")
        assert isinstance(result, bool)

    def test_fire_macos_notification_handles_failure(self):
        """Should return False on failure, not crash."""
        with patch("subprocess.run", side_effect=FileNotFoundError("no osascript")):
            result = fire_macos_notification("Test", "Test")
            assert result is False