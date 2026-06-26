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
from datetime import datetime, timezone
from aiohttp import web, ClientSession

from ..config import get_settings
from ..database import SessionLocal
from ..models import UsageRecord
from .adapters import get_adapter

logger = logging.getLogger("token_tank.proxy")


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

    # Forward request
    async with ClientSession() as session:
        async with session.request(
            method=request.method,
            url=target_url,
            headers={k: v for k, v in headers.items() if k.lower() != "host"},
            data=body,
            ssl=False,
        ) as resp:
            response_body = await resp.read()

            # Parse usage from response
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

            # Return response to caller (transparent passthrough)
            # Strip Content-Type from headers — aiohttp rejects passing both
            # headers containing Content-Type AND the content_type parameter
            resp_headers = dict(resp.headers)
            resp_ct = resp.content_type
            if resp_ct:
                # Remove from headers so we can set it via content_type param
                resp_headers.pop("Content-Type", None)
                resp_headers.pop("content-type", None)

            return web.Response(
                status=resp.status,
                body=response_body,
                headers=resp_headers,
                content_type=resp_ct,
            )


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


def create_proxy_app() -> web.Application:
    """Create the aiohttp proxy application."""
    # Ensure DB tables exist
    from ..database import Base, engine
    Base.metadata.create_all(engine)

    app = web.Application()
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
