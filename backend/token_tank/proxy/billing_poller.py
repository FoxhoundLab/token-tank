"""Billing API poller — periodically fetches billing data from provider admin APIs."""

import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import Optional

import aiohttp
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import BillingSnapshot, Provider
from ..config import get_settings

logger = logging.getLogger("token_tank.billing")


class BillingPoller(ABC):
    """Base class for provider billing pollers.

    Each poller knows how to:
    1. Authenticate with the provider's admin/billing API
    2. Fetch billing data (spend, usage totals)
    3. Store a BillingSnapshot record in the database
    """

    provider_id: str = ""

    @abstractmethod
    async def fetch(self, provider: Provider) -> Optional[dict]:
        """Fetch billing data from the provider's admin API.

        Returns raw dict on success, None on failure/skip.
        """
        ...

    @abstractmethod
    def parse_snapshot(self, raw_data: dict, provider: Provider) -> Optional[BillingSnapshot]:
        """Parse raw API response into a BillingSnapshot record."""
        ...

    async def run_once(self, provider: Provider) -> Optional[BillingSnapshot]:
        """Fetch billing data and store a snapshot. Returns the snapshot or None."""
        try:
            raw_data = await self.fetch(provider)
            if raw_data is None:
                return None

            snapshot = self.parse_snapshot(raw_data, provider)
            if snapshot is None:
                return None

            db = SessionLocal()
            try:
                db.add(snapshot)
                db.commit()
                logger.info(
                    f"💰 Billing snapshot stored: {self.provider_id} | "
                    f"${snapshot.total_cost:.2f}"
                )
                return snapshot
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Billing poll failed for {self.provider_id}: {e}")
            return None


class AnthropicBillingPoller(BillingPoller):
    """Polls Anthropic's admin API for billing/usage data.

    Requires the provider to have an org_id configured.
    API docs: https://docs.anthropic.com/en/api/organizations
    """

    provider_id = "anthropic"
    api_base_url = "https://api.anthropic.com"

    async def fetch(self, provider: Provider) -> Optional[dict]:
        """Fetch usage data from Anthropic admin API."""
        if not provider.org_id:
            logger.debug(f"Anthropic provider {provider.id} has no org_id — skipping billing poll")
            return None

        # Decrypt API key
        from ..crypto import decrypt
        if not provider.api_key_encrypted:
            logger.debug(f"Anthropic provider {provider.id} has no API key — skipping")
            return None

        try:
            api_key = decrypt(provider.api_key_encrypted)
        except Exception as e:
            logger.error(f"Failed to decrypt API key for provider {provider.id}: {e}")
            return None

        # Build request for usage report
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        end = now.strftime("%Y-%m-%d")

        url = f"{self.api_base_url}/v1/organizations/{provider.org_id}/usage"
        params = {"start_date": start, "end_date": end}
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }

        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, params=params, headers=headers) as resp:
                if resp.status == 401:
                    logger.warning(f"Anthropic billing API returned 401 — check API key permissions")
                    return None
                if resp.status == 403:
                    logger.warning(f"Anthropic billing API returned 403 — key may lack admin access")
                    return None
                if resp.status == 404:
                    logger.warning(f"Anthropic billing API returned 404 — check org_id")
                    return None
                if not resp.ok:
                    logger.warning(f"Anthropic billing API returned {resp.status}")
                    return None

                return await resp.json()

    def parse_snapshot(self, raw_data: dict, provider: Provider) -> Optional[BillingSnapshot]:
        """Parse Anthropic usage response into a BillingSnapshot."""
        now = datetime.now(timezone.utc)

        # Anthropic returns usage grouped by model
        # Format: {"data": [{"model": "claude-sonnet-4", "input_tokens": X, "output_tokens": Y, "cost_usd": Z}]}
        usage_data = raw_data.get("data", raw_data.get("usage", []))

        total_cost = 0.0
        total_tokens = 0

        if isinstance(usage_data, list):
            for entry in usage_data:
                cost = entry.get("cost_usd", entry.get("cost", 0.0))
                tokens = entry.get("input_tokens", 0) + entry.get("output_tokens", 0)
                total_cost += float(cost)
                total_tokens += int(tokens)
        elif isinstance(usage_data, dict):
            total_cost = float(usage_data.get("total_cost", 0.0))
            total_tokens = int(usage_data.get("total_tokens", 0))

        return BillingSnapshot(
            provider=self.provider_id,
            provider_id=provider.id,
            period_start=now - timedelta(days=30),
            period_end=now,
            total_cost=round(total_cost, 6),
            total_tokens=total_tokens,
            raw_data=json.dumps(raw_data),
        )


# Registry of billing pollers
POLLERS: dict[str, BillingPoller] = {
    "anthropic": AnthropicBillingPoller(),
}


async def run_billing_poll_cycle():
    """Run one billing poll cycle across all configured providers."""
    db = SessionLocal()
    try:
        providers = db.query(Provider).filter(Provider.enabled == True).all()
        for provider in providers:
            poller = POLLERS.get(provider.provider)
            if poller:
                await poller.run_once(provider)
    finally:
        db.close()


def start_billing_pollers():
    """Start the APScheduler background job for billing polling.

    Called from FastAPI lifespan.
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        settings = get_settings()
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            run_billing_poll_cycle,
            IntervalTrigger(seconds=settings.billing_poll_interval),
            id="billing_poll",
            name="Token Tank billing poller",
            replace_existing=True,
        )
        scheduler.start()
        logger.info(
            f"Billing poller started — interval {settings.billing_poll_interval}s"
        )
        return scheduler
    except Exception as e:
        logger.error(f"Failed to start billing poller: {e}")
        return None
