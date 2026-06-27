"""Tests for the browser extension ingestion endpoint."""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from token_tank.main import app
from token_tank.models import UsageRecord


class TestExtensionEndpoint:
    def test_ingest_claude_usage(self, db_session):
        """POST extension data, verify UsageRecord created."""
        db_session.query(UsageRecord).delete()
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/v1/extension/usage", json={
            "provider": "claude_web",
            "data": {
                "timestamp": "2026-06-26T12:00:00Z",
                "message_count": 47,
                "rate_limited": False,
                "limit_message": None,
            },
            "timestamp": "2026-06-26T12:00:00Z",
        })

        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "ingested"
        assert data["provider"] == "claude_web"
        assert data["estimated_tokens"] == 47000  # 47 messages * 1000

    def test_ingest_chatgpt_rate_limited(self, db_session):
        """Rate-limited ChatGPT data gets recorded."""
        db_session.query(UsageRecord).delete()
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/v1/extension/usage", json={
            "provider": "chatgpt_web",
            "data": {
                "timestamp": "2026-06-26T12:00:00Z",
                "model": "gpt-4",
                "rate_limited": True,
                "limit_message": "You've reached the GPT-4 limit",
                "upgrade_prompt": True,
            },
            "timestamp": "2026-06-26T12:00:00Z",
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "chatgpt_web"

    def test_ingest_missing_message_count(self, db_session):
        """Missing message_count = 0 estimated tokens."""
        db_session.query(UsageRecord).delete()
        db_session.commit()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/v1/extension/usage", json={
            "provider": "claude_web",
            "data": {"timestamp": "2026-06-26T12:00:00Z"},
            "timestamp": "2026-06-26T12:00:00Z",
        })

        assert resp.status_code == 200
        assert resp.json()["estimated_tokens"] == 0
