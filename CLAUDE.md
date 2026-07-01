# CLAUDE.md — Token Tank

## What is Token Tank?
Local-first AI usage monitor with a fuel-gauge dashboard. FastAPI + aiohttp proxy intercepts AI API calls, logs token usage + cost to SQLite, displays on a React dashboard. Six providers: Anthropic, OpenAI, Z.AI, MiniMax, Ollama, LM Studio.

## Quick Reference

### Commands
```bash
# Backend tests
cd backend && .venv/bin/pytest tests/ -q

# Frontend type check
cd frontend && npx tsc --noEmit

# Frontend build
cd frontend && npm run build

# Launch both servers (proxy :8848 + API :8000)
cd backend && .venv/bin/python -m token_tank

# CLI
.venv/bin/python -m token_tank init    # Write ~/.token-tank/config.toml
.venv/bin/python -m token_tank status  # Check if running
```

### Project Structure
```
backend/
  token_tank/
    main.py          — FastAPI app + lifespan + static serving
    runner.py        — Async launcher (proxy + API in one process)
    cli.py           — CLI subcommands (start/stop/status/init)
    config.py        — Settings (pydantic-settings) + TOML read/write
    wizard.py        — First-run provider detection + LM Studio probe
    database.py      — SQLite engine + SessionLocal + WAL mode
    models.py        — Provider, UsageRecord, BillingSnapshot, Alert, AlertHistory
    schemas.py       — Pydantic response models
    crypto.py        — Fernet encryption for API keys
    analytics.py     — Burn rate, exhaustion projection, sparklines
    alert_engine.py  — Threshold evaluation + macOS notifications
    proxy/
      server.py      — aiohttp transparent proxy with streaming
      billing_poller.py — APScheduler billing API poller
      adapters/      — 6 provider adapters + registry
    routers/
      dashboard.py   — GET /dashboard, GET /compare
      providers.py   — CRUD + history + export
      alerts.py      — CRUD + history + toggle
      extension.py   — POST /extension/usage (browser extension)
  tests/             — 124 tests (pytest)
frontend/
  src/
    components/      — Dashboard, FuelGauge, ProviderCard, Settings, etc.
    styles/global.css — Current theme (being rewritten per DESIGN_SPEC.md)
  public/assets/fonts/ — 9 woff2 fonts (Sigurd, Collapse, Courier Prime, JetBrains Mono)
docs/
  design-ref/        — Hermes Browser Extension CSS + HTML + assets (reference)
  provider-setup.md, provider-pricing.md, architecture.md
extension/           — Chrome MV3 extension scaffold
DESIGN_SPEC.md        — Creative brief for UI (READ THIS for design work)
```

### Key Patterns
- **Adapters:** Each provider has `matches()`, `parse_usage()`, `estimate_cost()`. Registry in `adapters/__init__.py` (order matters — more specific first).
- **Config precedence:** env vars > TOML (`~/.token-tank/config.toml`) > defaults.
- **Encryption:** API keys stored Fernet-encrypted in DB. `crypto.py:encrypt()` / `decrypt()`.
- **Tests:** conftest.py has autouse `_clean_db` fixture that truncates all tables before each test.

### Constraints
- Don't change adapter interfaces (public API for contributors).
- Don't change DB schema (additive only).
- 124 tests must pass at all times.
- NEVER use system `python3` — always `backend/.venv/bin/python`.
