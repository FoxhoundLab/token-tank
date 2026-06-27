"""
Token Tank Proxy Server

A transparent forwarding proxy that intercepts AI API calls,
logs token usage, and forwards to the real provider.

Usage:
    python -m token_tank.proxy.server

Point your AI tools to http://localhost:8848 instead of the real API.
"""

import json
import logging
import ssl as ssl_module
from typing import Optional

from aiohttp import web, ClientSession, ClientTimeout, TCPConnector

from ..config import get_settings
from ..database import SessionLocal
from ..models import UsageRecord
from .adapters import get_adapter

logger = logging.getLogger("token_tank.proxy")

# Module-level client — reused across requests for connection pooling.
# Initialized lazily in create_proxy_app() via on_startup hook.
_client_session: Optional[ClientSession] = None


async def _get_client() -> ClientSession:
    """Return the app-scoped ClientSession (connection pooling)."""
    global _client_session
    if _client_session is None or _client_session.closed:
        # TCPConnector with default SSL verification enabled.
        # We do NOT disable cert checking — the proxy forwards to real HTTPS APIs.
        connector = TCPConnector(
            limit=100,           # max total connections
            limit_per_host=20,   # max per upstream
            ssl=ssl_module.create_default_context(),
        )
        # No total timeout — streaming/SSE responses can run for minutes.
        # Bound connect time so a hung upstream can't pin a connection forever.
        timeout = ClientTimeout(total=None, connect=15, sock_connect=15)
        _client_session = ClientSession(connector=connector, timeout=timeout)
    return _client_session


async def handle(request: web.Request) -> web.StreamResponse:
    """Forward request to provider and log usage."""
    path = request.path
    headers = dict(request.headers)
    body = await request.read()

    # Find matching adapter
    adapter = get_adapter(path, headers)
    if adapter is None:
        return web.json_response(
            {"error": "No matching provider for path", "path": path},
            status=404,
        )

    # Build target URL
    target_url = f"{adapter.api_base_url}{path}"
    if request.query_string:
        target_url += f"?{request.query_string}"

    # Check if this is a streaming request (SSE). Prefer parsing the JSON body
    # (handles arbitrary whitespace); fall back to a substring scan.
    is_stream = False
    if body:
        try:
            parsed = json.loads(body)
            is_stream = isinstance(parsed, dict) and bool(parsed.get("stream"))
        except (json.JSONDecodeError, ValueError):
            is_stream = b'"stream":true' in body or b'"stream": true' in body

    # Use app-scoped session for connection pooling
    session = await _get_client()

    if is_stream:
        return await _handle_stream(request, session, adapter, target_url, headers, body)
    else:
        return await _handle_normal(request, session, adapter, target_url, headers, body)


async def _handle_normal(
    request: web.Request,
    session: ClientSession,
    adapter,
    target_url: str,
    headers: dict,
    body: bytes,
) -> web.Response:
    """Forward a non-streaming request: receive full body, parse usage, return."""
    async with session.request(
        method=request.method,
        url=target_url,
        headers={k: v for k, v in headers.items() if k.lower() != "host"},
        data=body,
    ) as resp:
        response_body = await resp.read()

        # Parse usage from response
        _try_log_usage(adapter, response_body)

        # Return response to caller (transparent passthrough)
        resp_headers = dict(resp.headers)
        resp_ct = resp.content_type
        if resp_ct:
            resp_headers.pop("Content-Type", None)
            resp_headers.pop("content-type", None)

        return web.Response(
            status=resp.status,
            body=response_body,
            headers=resp_headers,
            content_type=resp_ct,
        )


async def _handle_stream(
    request: web.Request,
    session: ClientSession,
    adapter,
    target_url: str,
    headers: dict,
    body: bytes,
) -> web.StreamResponse:
    """Forward a streaming (SSE) request: pipe chunks through, parse usage from final chunk.

    For streaming responses, we:
    1. Forward the request to the upstream API
    2. Stream response chunks back to the caller as they arrive
    3. Buffer chunks to extract token usage from the final SSE event
    4. Log usage after the stream completes
    """
    buffered_data = b""
    final_usage = None

    async with session.request(
        method=request.method,
        url=target_url,
        headers={k: v for k, v in headers.items() if k.lower() != "host"},
        data=body,
    ) as resp:
        # Build the client response from the REAL upstream status/content-type so
        # an error (4xx/5xx) to a streaming request isn't masked as a 200 SSE body.
        passthrough_ct = resp.headers.get("Content-Type") or "text/event-stream"
        stream_response = web.StreamResponse(
            status=resp.status,
            headers={
                "Content-Type": passthrough_ct,
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
        await stream_response.prepare(request)

        async for chunk in resp.content.iter_any():
            # Forward chunk to caller immediately (transparent passthrough)
            await stream_response.write(chunk)
            buffered_data += chunk

            # Check for usage data in this chunk (Anthropic sends it in message_delta)
            try:
                chunk_text = chunk.decode("utf-8", errors="ignore")
                for line in chunk_text.split("\n"):
                    if line.startswith("data: ") and "usage" in line:
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            continue
                        try:
                            data = json.loads(data_str)
                            usage = adapter.parse_usage(data)
                            if usage:
                                final_usage = usage
                        except (json.JSONDecodeError, ValueError):
                            pass
            except Exception:
                pass

    await stream_response.write_eof()

    # Log usage after stream completes
    if final_usage:
        cost = adapter.estimate_cost(final_usage, final_usage.model)
        _log_usage(adapter.provider_id, final_usage, cost)
        logger.info(
            f"📊 {adapter.display_name} | {final_usage.model} | "
            f"{final_usage.input_tokens}+{final_usage.output_tokens} tokens | "
            f"${cost:.4f} (streamed)"
        )
    else:
        logger.debug(
            f"Stream completed for {adapter.display_name} — no usage data in SSE chunks"
        )

    return stream_response


def _try_log_usage(adapter, response_body: bytes) -> None:
    """Parse usage from response body and log it. Swallows JSON errors."""
    try:
        response_json = json.loads(response_body)
        usage = adapter.parse_usage(response_json)
        if usage:
            cost = adapter.estimate_cost(usage, usage.model)
            _log_usage(adapter.provider_id, usage, cost)
            logger.info(
                f"📊 {adapter.display_name} | {usage.model} | "
                f"{usage.input_tokens}+{usage.output_tokens} tokens | "
                f"${cost:.4f}"
            )
    except (json.JSONDecodeError, ValueError) as e:
        logger.debug(f"Could not parse usage from response: {e}")


def _log_usage(provider: str, usage, cost: float) -> None:
    """Write usage record to database."""
    try:
        db = SessionLocal()
        record = UsageRecord(
            provider=provider,
            model=usage.model,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            total_tokens=usage.total_tokens,
            estimated_cost=cost,
        )
        db.add(record)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log usage: {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass


async def _on_startup(app: web.Application) -> None:
    """Initialize resources on app startup."""
    await _get_client()
    logger.info("Proxy client session initialized")


async def _on_cleanup(app: web.Application) -> None:
    """Clean up resources on app shutdown."""
    global _client_session
    if _client_session and not _client_session.closed:
        await _client_session.close()
        _client_session = None
        logger.info("Proxy client session closed")


def create_proxy_app() -> web.Application:
    """Create the aiohttp proxy application."""
    # Ensure DB tables exist
    from ..database import Base, engine
    Base.metadata.create_all(engine)

    app = web.Application()
    app.on_startup.append(_on_startup)
    app.on_cleanup.append(_on_cleanup)
    # Catch-all route — forwards everything
    app.router.add_route("*", "/{tail:.*}", handle)
    return app


def run_proxy() -> None:
    """Start the proxy server."""
    settings = get_settings()
    app = create_proxy_app()
    logger.info(f"⛽ Token Tank Proxy starting on {settings.proxy_host}:{settings.proxy_port}")
    web.run_app(
        app,
        host=settings.proxy_host,
        port=settings.proxy_port,
        print=None,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_proxy()
