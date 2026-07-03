"""End-to-end connection-flow regression test.

Exercises the full user path with a stubbed upstream:
  1. Register a provider via the REST API   (Settings "Connect")
  2. Send a request through the proxy       (tool pointed at :8848)
  3. Proxy parses usage and logs it to the DB
  4. Dashboard endpoint reflects the new usage

No real API key is used — the upstream response is a stub matching the
provider's real response shape. Forwarding logic itself is untouched.
"""

import json

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from token_tank.main import app
from token_tank.proxy.server import handle
from tests.fixtures.responses import ANTHROPIC_RESPONSE


@pytest.fixture(autouse=True)
def _ensure_tables():
    """Create tables on the app's engine (standalone-run safety)."""
    from token_tank.database import Base, engine

    Base.metadata.create_all(engine)


def _mock_request(body: bytes, path: str, headers: dict | None = None):
    request = MagicMock()
    request.path = path
    request.headers = headers or {}
    request.method = "POST"
    request.query_string = ""
    request.read = AsyncMock(return_value=body)
    return request


def _mock_session(response_dict: dict):
    mock_resp = AsyncMock()
    mock_resp.status = 200
    mock_resp.read = AsyncMock(return_value=json.dumps(response_dict).encode())
    mock_resp.headers = {"content-type": "application/json"}
    mock_resp.content_type = "application/json"

    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=mock_resp)
    cm.__aexit__ = AsyncMock(return_value=None)

    session = AsyncMock()
    session.request = MagicMock(return_value=cm)
    session.closed = False
    return session


@pytest.mark.asyncio
async def test_connect_proxy_log_dashboard_roundtrip():
    """connect → proxy → log → dashboard, end to end."""
    client = TestClient(app)

    # 1. Connect: register the provider exactly as Settings does.
    resp = client.post(
        "/api/v1/providers",
        json={
            "provider": "anthropic",
            "display_name": "Anthropic E2E",
            "api_key": "sk-test-not-real",
        },
    )
    assert resp.status_code in (200, 201), resp.text
    provider_id = resp.json()["id"]

    try:
        # Baseline dashboard reading for anthropic.
        before = client.get("/api/v1/dashboard").json()
        base_tokens = next(
            (p["today_tokens"] for p in before["providers"] if p["provider"] == "anthropic"),
            0,
        )

        # 2+3. A tool call through the proxy, upstream stubbed with the real
        # Anthropic response shape. _log_usage runs for real against the DB.
        session = _mock_session(ANTHROPIC_RESPONSE)
        with patch("token_tank.proxy.server._get_client", return_value=session):
            proxied = await handle(
                _mock_request(
                    b'{"model":"claude-sonnet-4","max_tokens":32}',
                    "/v1/messages",
                    {"x-api-key": "sk-test-not-real"},
                )
            )
        assert proxied.status == 200

        expected_delta = (
            ANTHROPIC_RESPONSE["usage"]["input_tokens"]
            + ANTHROPIC_RESPONSE["usage"]["output_tokens"]
        )

        # 4. Dashboard reflects the logged usage.
        after = client.get("/api/v1/dashboard").json()
        row = next(
            (p for p in after["providers"] if p["provider"] == "anthropic"), None
        )
        assert row is not None, "anthropic missing from dashboard after traffic"
        assert row["today_tokens"] == base_tokens + expected_delta
        assert row["today_cost"] > 0
    finally:
        # Leave no residue for other tests.
        client.delete(f"/api/v1/providers/{provider_id}")


@pytest.mark.asyncio
async def test_proxy_error_passthrough_is_transparent():
    """Upstream 401 (bad key) reaches the caller unchanged — the UI's
    'what the provider sent' guarantee."""
    error_body = {"type": "error", "error": {"type": "authentication_error"}}
    session = _mock_session(error_body)
    session.request.return_value.__aenter__.return_value.status = 401

    with patch("token_tank.proxy.server._get_client", return_value=session):
        resp = await handle(
            _mock_request(b'{"model":"claude-sonnet-4"}', "/v1/messages")
        )

    assert resp.status == 401
    assert json.loads(resp.body)["error"]["type"] == "authentication_error"
