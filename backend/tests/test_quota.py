"""Tests for quota windows + extension quota ingestion."""

from datetime import datetime, timezone, timedelta
import json

import pytest
from fastapi.testclient import TestClient

from token_tank.main import app
from token_tank.models import Provider, QuotaWindow, UsageRecord


class TestQuotaAPI:
    def test_get_quota_for_provider(self, db_session):
        """GET /quota/{id} returns windows for a provider."""
        db_session.query(QuotaWindow).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p = Provider(provider="anthropic", display_name="Anthropic", api_tier="plan")
        db_session.add(p)
        db_session.commit()

        # Add a quota window
        qw = QuotaWindow(
            provider_id=p.id,
            window_type="5h",
            label="5h Session",
            used=4500.0,
            limit=10000.0,
            unit="tokens",
            reset_at=datetime.now(timezone.utc) + timedelta(hours=2),
            source="api",
        )
        db_session.add(qw)
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/v1/quota/{p.id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "anthropic"
        assert len(data["windows"]) == 1
        w = data["windows"][0]
        assert w["window_type"] == "5h"
        assert w["used"] == 4500.0
        assert w["limit"] == 10000.0
        assert w["percentage"] == 45.0  # 4500/10000 * 100

    def test_get_quota_404(self, db_session):
        """GET /quota/{invalid_id} returns 404."""
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/quota/nonexistent-id")
        assert resp.status_code == 404

    def test_get_all_quotas(self, db_session):
        """GET /quota returns all providers with windows."""
        db_session.query(QuotaWindow).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p1 = Provider(provider="anthropic", display_name="Anthropic")
        p2 = Provider(provider="openai", display_name="OpenAI")
        db_session.add_all([p1, p2])
        db_session.commit()

        qw1 = QuotaWindow(
            provider_id=p1.id, window_type="5h",
            used=100, limit=1000, source="api",
        )
        qw2 = QuotaWindow(
            provider_id=p2.id, window_type="weekly",
            used=50, limit=500, source="extension",
        )
        db_session.add_all([qw1, qw2])
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/quota")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        providers = {d["provider"]: d for d in data}
        assert "anthropic" in providers
        assert "openai" in providers
        assert len(providers["anthropic"]["windows"]) == 1
        assert len(providers["openai"]["windows"]) == 1


class TestExtensionQuota:
    def test_extension_quota_ingest(self, db_session):
        """POST /extension/quota creates QuotaWindow rows for the provider."""
        db_session.query(QuotaWindow).delete()
        db_session.query(UsageRecord).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p = Provider(provider="anthropic", display_name="Anthropic", api_tier="plan")
        db_session.add(p)
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/v1/extension/quota", json={
            "provider": "claude_web",
            "windows": [
                {
                    "window_type": "5h",
                    "label": "5h Session",
                    "used": 4200,
                    "limit": 10000,
                    "unit": "tokens",
                    "reset_at": (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat(),
                },
                {
                    "window_type": "weekly",
                    "label": "Weekly",
                    "used": 25000,
                    "limit": 100000,
                    "unit": "tokens",
                    "reset_at": (datetime.now(timezone.utc) + timedelta(days=4)).isoformat(),
                },
            ],
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ingested"
        assert data["provider"] == "anthropic"
        assert data["windows"] == 2

        # Verify in DB
        windows = db_session.query(QuotaWindow).filter_by(provider_id=p.id).all()
        assert len(windows) == 2
        assert all(w.source == "extension" for w in windows)

    def test_extension_quota_unknown_provider(self, db_session):
        """Unknown extension provider returns 400."""
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/v1/extension/quota", json={
            "provider": "nonexistent_web",
            "windows": [],
        })
        assert resp.status_code == 400

    def test_extension_quota_provider_not_configured(self, db_session):
        """Provider not yet configured returns 404."""
        db_session.query(Provider).delete()
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/v1/extension/quota", json={
            "provider": "claude_web",
            "windows": [{"window_type": "5h", "used": 1, "limit": 10}],
        })
        assert resp.status_code == 404

    def test_extension_quota_replaces_existing(self, db_session):
        """Re-posting replaces existing extension-sourced windows."""
        db_session.query(QuotaWindow).delete()
        db_session.query(Provider).delete()
        db_session.commit()

        p = Provider(provider="anthropic", display_name="Anthropic")
        db_session.add(p)
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)

        # First post
        client.post("/api/v1/extension/quota", json={
            "provider": "claude_web",
            "windows": [{"window_type": "5h", "used": 100, "limit": 1000}],
        })

        # Second post with different data
        client.post("/api/v1/extension/quota", json={
            "provider": "claude_web",
            "windows": [
                {"window_type": "5h", "used": 200, "limit": 1000},
                {"window_type": "weekly", "used": 500, "limit": 5000},
            ],
        })

        # Should have only the second post's windows (not 1+2=3)
        windows = db_session.query(QuotaWindow).filter_by(
            provider_id=p.id, source="extension"
        ).all()
        assert len(windows) == 2

    def test_provider_api_tier_roundtrip(self, db_session):
        """Create provider with api_tier, verify it persists."""
        db_session.query(Provider).delete()
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/v1/providers", json={
            "provider": "minimax",
            "display_name": "MiniMax",
            "api_key": "test-key",
            "api_tier": "pay_as_you_go",
        })

        assert resp.status_code == 201
        data = resp.json()
        assert data["api_tier"] == "pay_as_you_go"
