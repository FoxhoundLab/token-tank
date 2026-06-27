"""Tests for the analytics engine — burn rate, forecasting, sparklines."""

from datetime import datetime, timedelta, timezone
import pytest

from token_tank.analytics import (
    burn_rate,
    exhaustion_projection,
    sparkline_data,
    usage_window_info,
)
from token_tank.models import UsageRecord, Provider


def _seed_records(db, provider_name: str, count: int, hours_ago_start: int = 0):
    """Seed UsageRecords within a 2-hour window (spread by minutes)."""
    now = datetime.now(timezone.utc)
    for i in range(count):
        # Spread records across minutes within the window, not hours
        ts = now - timedelta(minutes=(hours_ago_start * 60) + i * 10)
        rec = UsageRecord(
            provider=provider_name,
            model="test-model",
            input_tokens=100 + i * 10,
            output_tokens=50 + i * 5,
            total_tokens=150 + i * 15,
            estimated_cost=0.001 * (i + 1),
            timestamp=ts,
        )
        db.add(rec)
    db.commit()


class TestBurnRate:
    def test_burn_rate_calculation(self, db_session):
        """Seed 10 records over 2 hours, verify rate calculation."""
        db_session.query(UsageRecord).delete()
        db_session.commit()
        _seed_records(db_session, "anthropic", 10, hours_ago_start=0)
        result = burn_rate(db_session, "anthropic", hours=2)

        assert "tokens_per_hour" in result
        assert "cost_per_hour" in result
        assert "trend" in result
        assert result["tokens_per_hour"] > 0
        assert result["cost_per_hour"] > 0
        assert result["sample_count"] == 10

    def test_burn_rate_trend_increasing(self, db_session):
        """More recent records should show increasing trend."""
        now = datetime.now(timezone.utc)
        # Old records (3-5 hours ago) — small
        for i in range(3):
            rec = UsageRecord(
                provider="zai", model="glm-5.2",
                input_tokens=10, output_tokens=5, total_tokens=15,
                estimated_cost=0.001,
                timestamp=now - timedelta(hours=5 - i),
            )
            db_session.add(rec)
        # Recent records (0-2 hours ago) — large
        for i in range(3):
            rec = UsageRecord(
                provider="zai", model="glm-5.2",
                input_tokens=1000, output_tokens=500, total_tokens=1500,
                estimated_cost=0.1,
                timestamp=now - timedelta(hours=2 - i),
            )
            db_session.add(rec)
        db_session.commit()

        result = burn_rate(db_session, "zai", hours=6)
        assert result["trend"] == "increasing"

    def test_burn_rate_no_data(self, db_session):
        """Empty provider returns zeros."""
        db_session.query(UsageRecord).delete()
        db_session.commit()

        result = burn_rate(db_session, "nonexistent", hours=1)
        assert result["tokens_per_hour"] == 0
        assert result["cost_per_hour"] == 0
        assert result["sample_count"] == 0


class TestExhaustionProjection:
    def test_exhaustion_projection(self, db_session):
        """Seed data, verify hours_remaining > 0."""
        db_session.query(UsageRecord).delete()
        db_session.commit()
        _seed_records(db_session, "anthropic", 5, hours_ago_start=0)
        result = exhaustion_projection(db_session, "anthropic", quota_limit=1_000_000)

        assert result is not None
        assert "hours_remaining" in result
        assert result["hours_remaining"] > 0

    def test_exhaustion_no_data(self, db_session):
        """No data returns None."""
        db_session.query(UsageRecord).delete()
        db_session.commit()

        result = exhaustion_projection(db_session, "nonexistent", quota_limit=1_000_000)
        assert result is None


class TestSparkline:
    def test_sparkline_data(self, db_session):
        """Seed 7 days of records, verify 7 daily buckets."""
        now = datetime.now(timezone.utc)
        for day in range(7):
            ts = now - timedelta(days=day)
            rec = UsageRecord(
                provider="zai", model="glm-5.2",
                input_tokens=100, output_tokens=50, total_tokens=150,
                estimated_cost=0.01,
                timestamp=ts,
            )
            db_session.add(rec)
        db_session.commit()

        result = sparkline_data(db_session, "zai", days=7)
        assert len(result) == 7
        for entry in result:
            assert "date" in entry
            assert "total_tokens" in entry
            assert "cost" in entry

    def test_sparkline_empty(self, db_session):
        """No data returns 7 zero-buckets (sparkline shape, all zeros)."""
        db_session.query(UsageRecord).delete()
        db_session.commit()

        result = sparkline_data(db_session, "nonexistent", days=7)
        # Function returns 7 daily buckets with zero values — that's a valid
        # sparkline shape for chart rendering (empty gauge line)
        assert len(result) == 7
        for entry in result:
            assert entry["total_tokens"] == 0


class TestUsageWindow:
    def test_usage_window_info(self, db_session):
        """Verify window boundaries are returned."""
        db_session.query(UsageRecord).delete()
        db_session.commit()
        _seed_records(db_session, "anthropic", 3, hours_ago_start=0)
        result = usage_window_info(db_session, "anthropic")

        assert "five_hour_start" in result
        assert "five_hour_reset" in result
        assert "weekly_start" in result
        assert "weekly_reset" in result
        assert "five_hour_usage" in result
        assert "weekly_usage" in result

    def test_usage_window_no_data(self, db_session):
        """No data returns zero usage."""
        db_session.query(UsageRecord).delete()
        db_session.commit()

        result = usage_window_info(db_session, "nonexistent")
        assert result["five_hour_usage"] == 0
        assert result["weekly_usage"] == 0