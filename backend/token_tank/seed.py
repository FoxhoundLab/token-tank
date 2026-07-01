"""Seed command — populate all 6 providers with realistic demo data.

Usage:
    python -m token_tank seed

Creates 6 Provider rows + 7 days of UsageRecord data with realistic
token counts, costs, and timestamps so the dashboard has something
to render during development and demos.
"""

from datetime import datetime, timedelta, timezone
import random
import sys

from .database import SessionLocal, init_db
from .models import Provider, UsageRecord, get_provider_type


# Realistic models + pricing per provider
SEED_DATA: list[dict] = [
    {
        "provider": "anthropic",
        "display_name": "Anthropic",
        "models": [
            ("claude-sonnet-4", 3000, 1500, 0.003, 0.015),
            ("claude-opus-4", 5000, 2500, 0.015, 0.075),
        ],
    },
    {
        "provider": "openai",
        "display_name": "OpenAI",
        "models": [
            ("gpt-4o", 2500, 1200, 0.0025, 0.010),
            ("o1", 4000, 2000, 0.015, 0.060),
        ],
    },
    {
        "provider": "zai",
        "display_name": "Z.AI",
        "models": [
            ("glm-5.2", 2000, 1000, 0.0006, 0.0022),
        ],
    },
    {
        "provider": "minimax",
        "display_name": "MiniMax",
        "models": [
            ("abab6.5-chat", 1500, 800, 0.0007, 0.0007),
        ],
    },
    {
        "provider": "ollama",
        "display_name": "Ollama",
        "models": [
            ("llama3.3:70b", 3000, 1500, 0.0, 0.0),
        ],
    },
    {
        "provider": "lmstudio",
        "display_name": "LM Studio",
        "models": [
            ("qwen3.6-35b-a3b", 2000, 1000, 0.0, 0.0),
        ],
    },
]


def seed_database() -> None:
    """Populate the database with demo providers and usage records."""
    init_db()
    db = SessionLocal()

    try:
        # Check if already seeded
        existing = db.query(Provider).count()
        if existing > 0:
            print(f"⚠  Database already has {existing} providers. Skipping seed.")
            print("   To re-seed, delete the database first:")
            print("   rm ~/.token-tank/usage.db")
            sys.exit(1)

        now = datetime.now(timezone.utc)
        total_records = 0

        for entry in SEED_DATA:
            # Create provider
            provider = Provider(
                provider=entry["provider"],
                display_name=entry["display_name"],
                api_key_encrypted=None,  # No real keys for demo
                org_id=None,
                enabled=True,
            )
            db.add(provider)
            db.flush()  # Get the ID

            ptype = get_provider_type(entry["provider"])

            # Generate 7 days of usage records
            for days_ago in range(7):
                for model_name, base_input, base_output, in_price, out_price in entry["models"]:
                    # 3-8 requests per day per model
                    num_requests = random.randint(3, 8)
                    for _ in range(num_requests):
                        # Spread throughout the day
                        hour = random.randint(0, 23)
                        minute = random.randint(0, 59)
                        ts = now - timedelta(days=days_ago, hours=now.hour - hour, minutes=now.minute - minute)

                        # Add some variance to token counts
                        input_tokens = int(base_input * random.uniform(0.5, 1.5))
                        output_tokens = int(base_output * random.uniform(0.5, 1.5))
                        total_tokens = input_tokens + output_tokens

                        # Calculate cost
                        cost = (
                            input_tokens / 1_000_000 * in_price
                            + output_tokens / 1_000_000 * out_price
                        )

                        record = UsageRecord(
                            provider=entry["provider"],
                            model=model_name,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            total_tokens=total_tokens,
                            estimated_cost=round(cost, 6),
                            timestamp=ts,
                        )
                        db.add(record)
                        total_records += 1

            db.commit()
            print(f"  ✓ {entry['display_name']:12s} ({ptype:12s}) — seeded")

        print(f"\n✅ Seeded {len(SEED_DATA)} providers with {total_records} usage records.")
        print("   Start the dashboard: python -m token_tank")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()
