"""Tests for history, analytics, and export endpoints."""

from datetime import datetime, timedelta, timezone
import pytest
import json

from token_tank.models import UsageRecord, Provider
from fastapi.testclient import TestClient
from token_tank.main import app


def _seed_daily_records(db, provider_name: str, days: int, models: list[str] = None):
    """Seed one record per day for N days."""
    now = datetime.now(timezone.utc)
    models = models or ["test-model"]
    for day in range(days):
        for model in models:
            ts = now - timedelta(days=day)
            rec = UsageRecord(
                provider=provider_name, model=model,
                input_tokens=100, output_tokens=50, total_tokens=150,
                estimated_cost=0.01,
                timestamp=ts,
            )
            db.add(rec)
    db.commit()


class TestHistoryEndpoint:
    def test_history_returns_daily_totals(self, db_session):
        """GET /providers/{id}/history returns daily totals."""
        db_session.query(UsageRecord).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p = Provider(provider="anthropic", display_name="Anthropic")
        db_session.add(p)
        db_session.commit()

        _seed_daily_records(db_session, "anthropic", 7)

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/v1/providers/{p.id}/history", params={"range": "7d"})

        assert resp.status_code == 200, f"History failed: {resp.text}"
        data = resp.json()
        assert "daily_totals" in data
        assert len(data["daily_totals"]) > 0

    def test_history_model_breakdown(self, db_session):
        """History should include model breakdown with percentages."""
        db_session.query(UsageRecord).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p = Provider(provider="zai", display_name="Z.AI")
        db_session.add(p)
        db_session.commit()

        _seed_daily_records(db_session, "zai", 5, models=["glm-5.2", "glm-4"])

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/v1/providers/{p.id}/history", params={"range": "30d"})

        assert resp.status_code == 200
        data = resp.json()
        assert "model_breakdown" in data
        assert len(data["model_breakdown"]) >= 2

    def test_history_range_filter(self, db_session):
        """Test ?range=7d vs ?range=30d returns different counts."""
        db_session.query(UsageRecord).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p = Provider(provider="anthropic", display_name="Anthropic")
        db_session.add(p)
        db_session.commit()

        _seed_daily_records(db_session, "anthropic", 30)

        client = TestClient(app, raise_server_exceptions=False)
        resp_7d = client.get(f"/api/v1/providers/{p.id}/history", params={"range": "7d"})
        resp_30d = client.get(f"/api/v1/providers/{p.id}/history", params={"range": "30d"})

        assert resp_7d.status_code == 200
        assert resp_30d.status_code == 200
        data_7d = resp_7d.json()
        data_30d = resp_30d.json()
        assert len(data_30d["daily_totals"]) >= len(data_7d["daily_totals"])

    def test_history_404_nonexistent_provider(self, db_session):
        """Should return 404 for nonexistent provider."""
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/providers/nonexistent-id/history")
        assert resp.status_code == 404


class TestExportEndpoint:
    def test_export_csv(self, db_session):
        """GET export?format=csv returns CSV."""
        db_session.query(UsageRecord).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p = Provider(provider="anthropic", display_name="Anthropic")
        db_session.add(p)
        db_session.commit()

        _seed_daily_records(db_session, "anthropic", 3)

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/v1/providers/{p.id}/export", params={"format": "csv"})

        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")
        # Verify CSV has header + data rows
        lines = resp.text.strip().split("\n")
        assert len(lines) > 1  # header + at least 1 data row
        assert "timestamp" in lines[0].lower() or "provider" in lines[0].lower()

    def test_export_json(self, db_session):
        """GET export?format=json returns JSON array."""
        db_session.query(UsageRecord).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p = Provider(provider="zai", display_name="Z.AI")
        db_session.add(p)
        db_session.commit()

        _seed_daily_records(db_session, "zai", 3)

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/v1/providers/{p.id}/export", params={"format": "json"})

        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0


class TestCompareEndpoint:
    def test_compare_providers(self, db_session):
        """GET /compare returns cross-provider comparison."""
        db_session.query(UsageRecord).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p1 = Provider(provider="anthropic", display_name="Anthropic")
        p2 = Provider(provider="zai", display_name="Z.AI")
        db_session.add_all([p1, p2])
        db_session.commit()

        _seed_daily_records(db_session, "anthropic", 5)
        _seed_daily_records(db_session, "zai", 5)

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/compare")

        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 2
        for entry in data:
            assert "provider" in entry
            assert "total_tokens_30d" in entry
            assert "total_cost_30d" in entry