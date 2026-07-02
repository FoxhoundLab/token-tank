"""Quota Poller — tracks provider subscription usage windows.

Different providers expose their quota state through different channels:
- Anthropic: admin API at api.anthropic.com (5h + weekly + model-specific)
- OpenAI, Z.AI, MiniMax, Ollama: no public API. Data comes from the
  browser extension scraping their web dashboards.

This module defines a base class and the Anthropic implementation. Other
providers receive their quota data via POST /api/v1/extension/quota
(handled by routers/extension.py).
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

import aiohttp
from sqlalchemy.orm import Session

from .crypto import decrypt
from .database import SessionLocal
from .models import Provider, QuotaWindow


class QuotaPoller(ABC):
    """Base class for provider-specific quota pollers."""

    provider_id: str  # 'anthropic', 'openai', etc.

    @abstractmethod
    async def fetch(self, provider: Provider) -> list[dict]:
        """Fetch quota windows from the provider's source.

        Returns a list of dicts, each with:
            window_type, label, used, limit, unit, reset_at, raw
        """
        ...

    def store(self, db: Session, provider: Provider, windows: list[dict]) -> None:
        """Upsert fetched windows into the quota_windows table.

        Replaces existing windows for this provider that have source='api'
        so we don't clobber windows set manually or by the extension.
        """
        from .models import _uuid
        from sqlalchemy import delete

        # Remove existing API-sourced windows for this provider
        db.execute(
            delete(QuotaWindow).where(
                QuotaWindow.provider_id == provider.id,
                QuotaWindow.source == "api",
            )
        )

        for w in windows:
            reset_at = w.get("reset_at")
            if isinstance(reset_at, str):
                try:
                    reset_at = datetime.fromisoformat(reset_at.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    reset_at = None

            qw = QuotaWindow(
                id=_uuid(),
                provider_id=provider.id,
                window_type=w["window_type"],
                label=w.get("label"),
                used=float(w.get("used", 0)),
                limit=float(w.get("limit", 0)),
                unit=w.get("unit", "tokens"),
                reset_at=reset_at,
                source="api",
                raw_data=json.dumps(w.get("raw", {})) if w.get("raw") else None,
            )
            db.add(qw)

        db.commit()


# ── Anthropic ──────────────────────────────────────────────────────


class AnthropicQuotaPoller(QuotaPoller):
    """Polls Anthropic admin API for usage limits + model-specific caps."""

    provider_id = "anthropic"
    api_base_url = "https://api.anthropic.com"

    async def fetch(self, provider: Provider) -> list[dict]:
        if not provider.org_id or not provider.api_key_encrypted:
            return []

        try:
            api_key = decrypt(provider.api_key_encrypted)
        except Exception:
            return []

        url = f"{self.api_base_url}/v1/organizations/{provider.org_id}/usage_limits"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "usage-limits-2025-01-01",
        }

        timeout = aiohttp.ClientTimeout(total=30)
        windows: list[dict] = []

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()

        for entry in data.get("data", []):
            window_name = entry.get("window", "")
            used = float(entry.get("used", 0))
            limit = float(entry.get("limit", 0))
            reset_at = entry.get("reset_at")
            unit = entry.get("unit", "tokens")

            if window_name == "five_hour":
                window_type = "5h"
                label = "5h Session"
            elif window_name == "seven_day":
                window_type = "weekly"
                label = "Weekly"
            elif window_name.startswith("model:"):
                window_type = window_name
                model_name = window_name.split(":", 1)[1]
                label = f"Model: {model_name}"
            else:
                window_type = window_name
                label = window_name.replace("_", " ").title()

            windows.append({
                "window_type": window_type,
                "label": label,
                "used": used,
                "limit": limit,
                "unit": unit,
                "reset_at": reset_at,
                "raw": entry,
            })

        return windows


# ── Registry ──────────────────────────────────────────────────────

QUOTA_POLLERS: dict[str, QuotaPoller] = {
    "anthropic": AnthropicQuotaPoller(),
}


# ── Cycle runner ──────────────────────────────────────────────────


async def run_quota_poll_cycle() -> dict[str, int]:
    """Poll all enabled providers with registered quota pollers.

    Returns a summary {provider_id: windows_updated}.
    """
    db = SessionLocal()
    summary: dict[str, int] = {}

    try:
        providers = db.query(Provider).filter(Provider.enabled == True).all()

        for provider in providers:
            poller = QUOTA_POLLERS.get(provider.provider)
            if not poller:
                continue

            try:
                windows = await poller.fetch(provider)
                if windows:
                    poller.store(db, provider, windows)
                    summary[provider.provider] = len(windows)
            except Exception as e:
                import logging
                logging.getLogger("token_tank.quota").warning(
                    f"Quota poll failed for {provider.provider}: {e}"
                )
    finally:
        db.close()

    return summary


# ── Scheduler integration ────────────────────────────────────────────


def start_quota_poller(interval_minutes: int = 5):
    """Start the background quota poller (5-min interval by default).

    Returns the BackgroundScheduler instance, or None if APScheduler is
    unavailable.
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        import asyncio

        scheduler = BackgroundScheduler()

        def _run_cycle_sync() -> None:
            asyncio.run(run_quota_poll_cycle())

        scheduler.add_job(
            _run_cycle_sync,
            "interval",
            minutes=interval_minutes,
            id="quota_poll",
            name="Quota poll cycle",
            replace_existing=True,
        )
        scheduler.start()
        return scheduler
    except ImportError:
        return None
