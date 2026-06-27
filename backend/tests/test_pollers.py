"""Tests for the billing API poller system."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta

from token_tank.proxy.billing_poller import (
    BillingPoller,
    AnthropicBillingPoller,
    POLLERS,
    run_billing_poll_cycle,
)
from token_tank.models import Provider, BillingSnapshot
from token_tank.crypto import encrypt


class TestAnthropicBillingPoller:
    """Test the Anthropic billing poller."""

    def setup_method(self):
        self.poller = AnthropicBillingPoller()

    def test_poller_registered(self):
        assert "anthropic" in POLLERS
        assert isinstance(POLLERS["anthropic"], AnthropicBillingPoller)

    @pytest.mark.asyncio
    async def test_fetch_no_org_id_returns_none(self, db_session):
        """Poller should skip when provider has no org_id."""
        provider = Provider(
            provider="anthropic",
            display_name="Anthropic",
            api_key_encrypted=encrypt("test-key"),
            org_id=None,
        )
        db_session.add(provider)
        db_session.commit()

        result = await self.poller.fetch(provider)
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_no_api_key_returns_none(self, db_session):
        """Poller should skip when provider has no API key."""
        provider = Provider(
            provider="anthropic",
            display_name="Anthropic",
            api_key_encrypted=None,
            org_id="org-123",
        )
        db_session.add(provider)
        db_session.commit()

        result = await self.poller.fetch(provider)
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_success(self, db_session):
        """Poller should fetch billing data from Anthropic admin API."""
        provider = Provider(
            provider="anthropic",
            display_name="Anthropic",
            api_key_encrypted=encrypt("test-key"),
            org_id="org-123",
        )
        db_session.add(provider)
        db_session.commit()

        # Mock the HTTP response
        mock_api_response = {
            "data": [
                {"model": "claude-sonnet-4", "input_tokens": 50000, "output_tokens": 10000, "cost_usd": 0.30},
                {"model": "claude-opus-4", "input_tokens": 5000, "output_tokens": 2000, "cost_usd": 0.225},
            ]
        }

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.ok = True
        mock_resp.json = AsyncMock(return_value=mock_api_response)

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_ctx)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)

        with patch("token_tank.proxy.billing_poller.aiohttp.ClientSession", return_value=mock_session):
            result = await self.poller.fetch(provider)

        assert result is not None
        assert "data" in result

    @pytest.mark.asyncio
    async def test_fetch_401_returns_none(self, db_session):
        """Poller should handle 401 gracefully."""
        provider = Provider(
            provider="anthropic",
            display_name="Anthropic",
            api_key_encrypted=encrypt("bad-key"),
            org_id="org-123",
        )
        db_session.add(provider)
        db_session.commit()

        mock_resp = AsyncMock()
        mock_resp.status = 401
        mock_resp.ok = False

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_ctx)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)

        with patch("token_tank.proxy.billing_poller.aiohttp.ClientSession", return_value=mock_session):
            result = await self.poller.fetch(provider)

        assert result is None

    def test_parse_snapshot_list_format(self):
        """parse_snapshot should handle list-format usage data."""
        provider = Provider(
            provider="anthropic",
            display_name="Anthropic",
            org_id="org-123",
        )

        raw_data = {
            "data": [
                {"model": "claude-sonnet-4", "input_tokens": 50000, "output_tokens": 10000, "cost_usd": 0.30},
                {"model": "claude-opus-4", "input_tokens": 5000, "output_tokens": 2000, "cost_usd": 0.225},
            ]
        }

        snapshot = self.poller.parse_snapshot(raw_data, provider)
        assert snapshot is not None
        assert snapshot.provider == "anthropic"
        assert snapshot.total_cost == pytest.approx(0.525, rel=0.01)
        assert snapshot.total_tokens == 67000

    def test_parse_snapshot_dict_format(self):
        """parse_snapshot should handle dict-format usage data."""
        provider = Provider(
            provider="anthropic",
            display_name="Anthropic",
            org_id="org-123",
        )

        raw_data = {
            "usage": {
                "total_cost": 1.50,
                "total_tokens": 100000,
            }
        }

        snapshot = self.poller.parse_snapshot(raw_data, provider)
        assert snapshot is not None
        assert snapshot.total_cost == pytest.approx(1.50, rel=0.01)
        assert snapshot.total_tokens == 100000

    @pytest.mark.asyncio
    async def test_run_once_stores_snapshot(self, db_session):
        """run_once should write a BillingSnapshot to the DB."""
        # Clean existing
        db_session.query(BillingSnapshot).delete()
        db_session.commit()

        provider = Provider(
            provider="anthropic",
            display_name="Anthropic",
            api_key_encrypted=encrypt("test-key"),
            org_id="org-123",
        )
        db_session.add(provider)
        db_session.commit()

        mock_api_response = {
            "data": [{"model": "claude-sonnet-4", "input_tokens": 1000, "output_tokens": 500, "cost_usd": 0.01}]
        }

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.ok = True
        mock_resp.json = AsyncMock(return_value=mock_api_response)

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_ctx)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)

        with patch("token_tank.proxy.billing_poller.aiohttp.ClientSession", return_value=mock_session):
            with patch("token_tank.proxy.billing_poller.SessionLocal", return_value=db_session):
                result = await self.poller.run_once(provider)

        assert result is not None
        assert result.total_cost == pytest.approx(0.01, rel=0.01)

        snapshots = db_session.query(BillingSnapshot).all()
        assert len(snapshots) >= 1
        assert snapshots[-1].provider == "anthropic"


class TestBillingPollCycle:
    """Test the full billing poll cycle."""

    @pytest.mark.asyncio
    async def test_run_cycle_with_no_providers(self, db_session):
        """Running cycle with no providers should not crash."""
        db_session.query(Provider).delete()
        db_session.commit()

        with patch("token_tank.proxy.billing_poller.SessionLocal", return_value=db_session):
            await run_billing_poll_cycle()
