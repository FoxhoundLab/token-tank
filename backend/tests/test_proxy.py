"""Proxy server tests — verify forwarding, usage logging, streaming, and passthrough."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from token_tank.proxy.server import handle, _log_usage, _try_log_usage
from token_tank.proxy.adapters.base import TokenUsage
from tests.fixtures.responses import ANTHROPIC_RESPONSE, ZAI_RESPONSE


def _build_mock_response(response_dict: dict, status: int = 200):
    """Build a mock upstream response object."""
    mock_resp = AsyncMock()
    mock_resp.status = status
    mock_resp.read = AsyncMock(return_value=json.dumps(response_dict).encode())
    mock_resp.headers = {"content-type": "application/json"}
    mock_resp.content_type = "application/json"
    return mock_resp


def _build_mock_request_cm(mock_resp):
    """Build a mock async context manager for session.request()."""
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=mock_resp)
    cm.__aexit__ = AsyncMock(return_value=None)
    return cm


def _build_mock_session(mock_resp):
    """Build a mock ClientSession with request returning mock_resp."""
    mock_session = AsyncMock()
    mock_session.request = MagicMock(return_value=_build_mock_request_cm(mock_resp))
    mock_session.closed = False
    return mock_session


def _build_mock_request(body: bytes, path: str, headers: dict = None):
    """Build a mock aiohttp request."""
    request = MagicMock()
    request.path = path
    request.headers = headers or {}
    request.method = "POST"
    request.query_string = ""
    request.read = AsyncMock(return_value=body)
    return request


class TestProxyRouting:
    """Test that the proxy correctly routes requests to adapters."""

    @pytest.mark.asyncio
    async def test_unknown_path_returns_404(self):
        """Requests to unknown paths should return 404."""
        request = _build_mock_request(b"", "/totally/unknown/path")
        response = await handle(request)
        assert response.status == 404
        body = json.loads(response.body)
        assert "error" in body
        assert body["path"] == "/totally/unknown/path"


class TestUsageLogging:
    """Test that usage records are written to the database."""

    def test_log_usage_writes_record(self, db_session):
        """_log_usage should create a UsageRecord in the DB."""
        from token_tank.models import UsageRecord
        db_session.query(UsageRecord).delete()
        db_session.commit()

        usage = TokenUsage(
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            model="claude-sonnet-4-20250514",
        )

        with patch("token_tank.proxy.server.SessionLocal", return_value=db_session):
            _log_usage("anthropic", usage, 0.00105)

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
        # SessionLocal raises on call — should be caught
        with patch("token_tank.proxy.server.SessionLocal", side_effect=Exception("DB down")):
            _log_usage("test", usage, 0.0)

    def test_log_usage_handles_commit_error(self):
        """_log_usage should not crash if commit fails."""
        usage = TokenUsage(
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            model="test",
        )
        mock_session = MagicMock()
        mock_session.commit = MagicMock(side_effect=Exception("Commit failed"))
        with patch("token_tank.proxy.server.SessionLocal", return_value=mock_session):
            _log_usage("test", usage, 0.0)


class TestTryLogUsage:
    """Test the _try_log_usage helper."""

    def test_parses_valid_response(self):
        """_try_log_usage should parse usage from a valid response body."""
        body = json.dumps(ANTHROPIC_RESPONSE).encode()
        with patch("token_tank.proxy.server._log_usage") as mock_log:
            from token_tank.proxy.adapters.anthropic import AnthropicAdapter
            adapter = AnthropicAdapter()
            _try_log_usage(adapter, body)
            mock_log.assert_called_once()
            assert mock_log.call_args[0][0] == "anthropic"

    def test_swallows_invalid_json(self):
        """_try_log_usage should silently handle invalid JSON."""
        from token_tank.proxy.adapters.anthropic import AnthropicAdapter
        adapter = AnthropicAdapter()
        _try_log_usage(adapter, b"not json at all")  # should not raise


class TestHandleForwarding:
    """Test the handle() function with mocked upstream calls."""

    @pytest.mark.asyncio
    async def test_handle_forwards_anthropic_request(self):
        """handle() should forward to Anthropic API and parse usage."""
        mock_resp = _build_mock_response(ANTHROPIC_RESPONSE)
        mock_session = _build_mock_session(mock_resp)

        with patch("token_tank.proxy.server._get_client", return_value=mock_session):
            with patch("token_tank.proxy.server._log_usage") as mock_log:
                request = _build_mock_request(
                    b'{"model":"claude-sonnet-4"}',
                    "/v1/messages",
                    {"x-api-key": "test-key"},
                )

                response = await handle(request)
                assert response.status == 200
                mock_log.assert_called_once()
                assert mock_log.call_args[0][0] == "anthropic"

    @pytest.mark.asyncio
    async def test_handle_forwards_zai_request(self):
        """handle() should forward to Z.AI and parse usage."""
        mock_resp = _build_mock_response(ZAI_RESPONSE)
        mock_session = _build_mock_session(mock_resp)

        with patch("token_tank.proxy.server._get_client", return_value=mock_session):
            with patch("token_tank.proxy.server._log_usage") as mock_log:
                request = _build_mock_request(
                    b'{"model":"glm-5.2"}',
                    "/api/paas/v4/chat/completions",
                    {"Authorization": "Bearer test"},
                )

                response = await handle(request)
                assert response.status == 200
                mock_log.assert_called_once()
                assert mock_log.call_args[0][0] == "zai"

    @pytest.mark.asyncio
    async def test_streaming_request_detected(self):
        """handle() should route to streaming handler for stream:true requests."""
        mock_stream = AsyncMock(return_value=MagicMock(status=200))
        mock_normal = AsyncMock()

        with patch("token_tank.proxy.server._get_client", return_value=MagicMock()):
            with patch("token_tank.proxy.server._handle_stream", mock_stream):
                with patch("token_tank.proxy.server._handle_normal", mock_normal):
                    request = _build_mock_request(
                        b'{"model":"claude-sonnet-4","stream":true}',
                        "/v1/messages",
                    )
                    await handle(request)
                    mock_stream.assert_called_once()
                    mock_normal.assert_not_called()


class TestStreamingPassthrough:
    """Test the streaming response handler."""

    @pytest.mark.asyncio
    async def test_stream_handler_returns_stream_response(self):
        """_handle_stream should return a StreamResponse."""
        from token_tank.proxy.server import _handle_stream

        # Build a mock request with prepare/write
        mock_request = MagicMock()
        mock_request.method = "POST"
        mock_request.read = AsyncMock(
            return_value=b'{"model":"claude-sonnet-4","stream":true}'
        )

        # Build mock upstream response with streaming content
        async def _mock_iter():
            yield b'data: {"type":"message_start","message":{"usage":{"input_tokens":25}}}\n\n'
            yield b'data: {"type":"message_delta","usage":{"output_tokens":15}}\n\n'
            yield b'data: [DONE]\n\n'

        mock_content = AsyncMock()
        mock_content.iter_any = MagicMock(return_value=_mock_iter())

        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.content = mock_content

        mock_request_cm = AsyncMock()
        mock_request_cm.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_request_cm.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.request = MagicMock(return_value=mock_request_cm)

        adapter = MagicMock()
        adapter.display_name = "Test"
        adapter.estimate_cost.return_value = 0.001

        # Mock StreamResponse
        with patch("token_tank.proxy.server.web.StreamResponse") as MockStream:
            mock_stream_resp = AsyncMock()
            mock_stream_resp.prepare = AsyncMock()
            mock_stream_resp.write = AsyncMock()
            mock_stream_resp.write_eof = AsyncMock()
            MockStream.return_value = mock_stream_resp

            with patch("token_tank.proxy.server._log_usage") as mock_log:
                result = await _handle_stream(
                    mock_request, mock_session, adapter,
                    "https://api.anthropic.com/v1/messages",
                    {"x-api-key": "test"}, b'{"stream":true}',
                )

                # Stream response was prepared and written to
                mock_stream_resp.prepare.assert_called_once()
                assert mock_stream_resp.write.call_count == 3
                mock_stream_resp.write_eof.assert_called_once()
