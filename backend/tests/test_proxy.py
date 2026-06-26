"""Proxy server tests — verify forwarding, usage logging, and passthrough."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from token_tank.proxy.server import handle, _log_usage
from token_tank.proxy.adapters.base import TokenUsage
from tests.fixtures.responses import ANTHROPIC_RESPONSE, ZAI_RESPONSE


class TestProxyRouting:
    """Test that the proxy correctly routes requests to adapters."""

    @pytest.mark.asyncio
    async def test_unknown_path_returns_404(self):
        """Requests to unknown paths should return 404."""
        request = MagicMock()
        request.path = "/totally/unknown/path"
        request.headers = {}
        request.method = "GET"
        request.query_string = ""
        request.read = AsyncMock(return_value=b"")

        response = await handle(request)
        assert response.status == 404
        body = json.loads(response.body)
        assert "error" in body
        assert body["path"] == "/totally/unknown/path"


class TestUsageLogging:
    """Test that usage records are written to the database."""

    def test_log_usage_writes_record(self, db_session):
        """_log_usage should create a UsageRecord in the DB."""
        usage = TokenUsage(
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            model="claude-sonnet-4-20250514",
        )

        with patch("token_tank.proxy.server.SessionLocal", return_value=db_session):
            _log_usage("anthropic", usage, 0.00105)

        from token_tank.models import UsageRecord
        records = db_session.query(UsageRecord).all()
        assert len(records) == 1
        assert records[0].provider == "anthropic"
        assert records[0].input_tokens == 100
        assert records[0].output_tokens == 50
        assert records[0].estimated_cost == 0.00105

    def test_log_usage_handles_db_error_gracefully(self):
        """_log_usage should not crash if DB is unavailable."""
        usage = TokenUsage(
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            model="test",
        )
        # Should not raise even with a bad session
        with patch("token_tank.proxy.server.SessionLocal", side_effect=Exception("DB down")):
            _log_usage("test", usage, 0.0)


class TestHandleForwarding:
    """Test the handle() function with mocked upstream calls."""

    @pytest.mark.asyncio
    async def test_handle_forwards_anthropic_request(self):
        """handle() should forward to Anthropic API and parse usage."""
        # Build mock upstream response
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.read = AsyncMock(
            return_value=json.dumps(ANTHROPIC_RESPONSE).encode()
        )
        mock_resp.headers = {"content-type": "application/json"}
        mock_resp.content_type = "application/json"

        # Mock the ClientSession
        mock_session = AsyncMock()
        mock_request_cm = AsyncMock()
        mock_request_cm.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_request_cm.__aexit__ = AsyncMock(return_value=None)
        mock_session.request = MagicMock(return_value=mock_request_cm)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)

        with patch("token_tank.proxy.server.ClientSession", return_value=mock_session):
            with patch("token_tank.proxy.server._log_usage") as mock_log:
                request = MagicMock()
                request.path = "/v1/messages"
                request.headers = {"x-api-key": "test-key"}
                request.method = "POST"
                request.query_string = ""
                request.read = AsyncMock(
                    return_value=b'{"model":"claude-sonnet-4"}'
                )

                response = await handle(request)

                assert response.status == 200
                # Verify usage was parsed and logged
                mock_log.assert_called_once()
                call_args = mock_log.call_args
                assert call_args[0][0] == "anthropic"

    @pytest.mark.asyncio
    async def test_handle_forwards_zai_request(self):
        """handle() should forward to Z.AI and parse usage."""
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.read = AsyncMock(
            return_value=json.dumps(ZAI_RESPONSE).encode()
        )
        mock_resp.headers = {"content-type": "application/json"}
        mock_resp.content_type = "application/json"

        mock_session = AsyncMock()
        mock_request_cm = AsyncMock()
        mock_request_cm.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_request_cm.__aexit__ = AsyncMock(return_value=None)
        mock_session.request = MagicMock(return_value=mock_request_cm)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)

        with patch("token_tank.proxy.server.ClientSession", return_value=mock_session):
            with patch("token_tank.proxy.server._log_usage") as mock_log:
                request = MagicMock()
                request.path = "/api/paas/v4/chat/completions"
                request.headers = {"Authorization": "Bearer test"}
                request.method = "POST"
                request.query_string = ""
                request.read = AsyncMock(
                    return_value=b'{"model":"glm-5.2"}'
                )

                response = await handle(request)
                assert response.status == 200
                mock_log.assert_called_once()
                assert mock_log.call_args[0][0] == "zai"
