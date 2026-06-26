# Token Tank — Architecture Specification

> ⛽ Multi-provider AI usage monitor. One dashboard, all your AI subscriptions, fuel-gauge style.

**Version:** 1.0  
**Date:** June 26, 2026  
**Status:** Pre-build — architecture locked, ready for scaffold

---

## 1. Product Summary

Token Tank is a **local-first AI usage monitoring application** that tracks token consumption, API spend, and burn rate across multiple AI providers on a single dashboard. Each provider is visualized as a fuel gauge (Full → Empty), giving users an instant, intuitive read on their AI "fuel levels."

### Core Metaphor
- Providers = **tanks**
- Usage level = **fuel level** (F → E gauge)
- Running low = **amber light** notifications
- Adding a subscription = **fueling up**
- Burn rate = **MPG equivalent** (tokens/day, $/day)

---

## 2. Data Strategy (Locked)

The hardest problem in this product is data acquisition. Subscription-level limits (Claude Pro message caps, ChatGPT Plus GPT-4 caps) are **universally inaccessible via API**. Token Tank solves this with a **two-layer data strategy**:

### Layer 1: Proxy Gateway (Universal Token Tracking)
A lightweight local proxy that sits between the user's AI tools and the provider APIs. Every request/response flows through it. The proxy:
- Forwards requests transparently to the real provider API
- Intercepts the response and parses token counts (`prompt_tokens`, `completion_tokens`)
- Logs usage to local SQLite with: timestamp, provider, model, tokens, estimated cost
- Captures rate-limit headers (`x-ratelimit-*`) when available
- **Works for ALL providers** — Anthropic, OpenAI, Z.AI, Ollama, and any future provider

### Layer 2: Billing API Poller (Where Available)
A scheduled background job that pulls cost/usage data directly from providers that expose billing APIs:
- **Anthropic**: `GET /v1/organizations/{org_id}/usage/reports` + `/cost/reports` (Admin API key required)
- **OpenAI**: `GET /v1/dashboard/billing/usage` + `/organization/usage/costs` (regular API key)
- **Z.AI**: Not available (proxy-only)
- **Ollama Pro**: Not available (proxy-only)

### Phase 2 (Future): Browser Extension
For subscription-level caps (Claude Pro messages, ChatGPT Plus limits), a browser extension that injects into provider web UIs and reads usage counters from the DOM. This captures data no API can provide.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S MACHINE                        │
│                                                         │
│  ┌───────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │ AI Tools  │───▶│ Token Tank   │───▶│ Provider    │  │
│  │ (Cursor,  │    │ Proxy Server │    │ APIs        │  │
│  │ Claude    │    │ (port 8848)  │    │             │  │
│  │ Code, etc)│    └──────┬───────┘    └─────────────┘  │
│  └───────────┘           │                              │
│                          │ token log                    │
│                          ▼                              │
│  ┌───────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │ Billing   │───▶│ Billing      │───▶│             │  │
│  │ API       │    │ Poller       │    │             │  │
│  │ (cron)    │    │ (every 5min) │    │             │  │
│  └───────────┘    └──────┬───────┘    │             │  │
│                          │            │             │  │
│                          ▼            │             │  │
│                   ┌──────────────┐    │             │  │
│                   │ SQLite DB    │    │             │  │
│                   │ (usage.log)  │    │             │  │
│                   └──────┬───────┘    │             │  │
│                          │            │             │  │
│                          ▼            │             │  │
│                   ┌──────────────┐    │             │  │
│                   │ FastAPI      │    │             │  │
│                   │ Backend      │    │             │  │
│                   │ (port 8000)  │    │             │  │
│                   └──────┬───────┘    │             │  │
│                          │            │             │  │
│                          ▼            │             │  │
│                   ┌──────────────┐    │             │  │
│                   │ React        │    │             │  │
│                   │ Dashboard    │    │             │  │
│                   │ (port 5173)  │    │             │  │
│                   └──────────────┘    │             │  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 3.1 Proxy Server (`token_tank/proxy/`)
- **Tech**: Python + `httpx` / `aiohttp` for async forwarding
- **Default port**: 8848
- **Behavior**: Drop-in replacement for provider API base URLs
  - `localhost:8848/v1/messages` → forwards to `api.anthropic.com/v1/messages`
  - `localhost:8848/v1/chat/completions` → forwards to `api.openai.com/v1/chat/completions`
  - `localhost:8848/api/chat` → forwards to `api.z.ai/api/paas/v4/chat/completions` or `ollama.com/api/chat`
- **Routing**: Detects target provider from request path + headers
- **Logging**: Parses response body for token counts, writes to SQLite
- **Transparency**: Passes through all headers, status codes, streaming responses unchanged

#### 3.2 Billing Poller (`token_tank/pollers/`)
- **Tech**: Python `APScheduler` or simple `asyncio` loop
- **Schedule**: Every 5 minutes (configurable)
- **Per-provider adapters**: Each knows its billing API endpoints and auth
- **Fallback**: If billing API unavailable (Z.AI, Ollama), skips silently — proxy data fills the gap

#### 3.3 SQLite Database (`token_tank/database.py`)
- **Database file**: `~/.token-tank/usage.db` (or configurable path)
- **Tables**:
  - `usage_records` — per-request token logs from proxy
  - `billing_snapshots` — periodic cost data from billing APIs
  - `providers` — configured provider connections
  - `alerts` — alert threshold configurations
  - `alert_history` — fired alerts log

#### 3.4 FastAPI Backend (`token_tank/main.py`)
- **Port**: 8000
- **Endpoints**:
  - `GET /api/v1/dashboard` — aggregated usage data for all providers
  - `GET /api/v1/providers` — list configured providers
  - `POST /api/v1/providers` — add/connect a provider
  - `PATCH /api/v1/providers/{id}` — update provider settings
  - `DELETE /api/v1/providers/{id}` — disconnect provider
  - `GET /api/v1/providers/{id}/usage` — per-provider usage history
  - `GET /api/v1/alerts` — list alerts
  - `POST /api/v1/alerts` — create alert
  - `GET /api/v1/settings` — app settings
  - `PATCH /api/v1/settings` — update settings
  - `WS /ws` — WebSocket for real-time usage updates

#### 3.5 React Dashboard (`frontend/`)
- **Tech**: React 18 + Vite + TypeScript + Tailwind CSS
- **Port**: 5173 (dev), served by FastAPI in production
- **Key Components**:
  - `FuelGauge` — SVG fuel gauge needle component (F → E)
  - `ProviderCard` — card per provider with gauge + stats
  - `Dashboard` — grid of provider cards + aggregate
  - `Settings` — provider connection management
  - `AlertPanel` — alert configuration
  - `UsageChart` — sparkline/trend chart per provider
  - `BurnRate` — tokens/day, $/day indicator

---

## 4. Provider Adapter Specification

Each provider needs an adapter implementing this interface:

```python
class ProviderAdapter:
    # Identity
    provider_id: str           # "anthropic", "openai", "zai", "ollama"
    display_name: str          # "Anthropic", "OpenAI", etc.
    
    # Proxy routing
    api_base_url: str          # Where to forward requests
    path_prefixes: list[str]   # Which paths belong to this provider
    
    # Token parsing
    def parse_usage(response: dict) -> TokenUsage:
        """Extract token counts from API response body."""
        ...
    
    # Billing (optional — None if not supported)
    billing_poller: BillingPoller | None
    
    # Cost estimation
    def estimate_cost(usage: TokenUsage, model: str) -> float:
        """Estimate cost based on provider pricing."""
        ...
```

### Provider Support Matrix

| Provider | Proxy Tracking | Billing API | Cost Estimation | Rate Limit Headers |
|---|---|---|---|---|
| Anthropic | ✅ All models | ✅ Admin API | ✅ Published pricing | ✅ `anthropic-ratelimit-*` |
| OpenAI | ✅ All models | ✅ Billing API | ✅ Published pricing | ✅ `x-ratelimit-*` |
| Z.AI | ✅ GLM models | ❌ | ✅ Published pricing | ❓ Unknown |
| Ollama | ✅ All models | ❌ | ✅ Tier-based (L1-L4) | ❌ |

---

## 5. Database Schema

```sql
-- Per-request usage logs from proxy
CREATE TABLE usage_records (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider TEXT NOT NULL,          -- 'anthropic', 'openai', 'zai', 'ollama'
    model TEXT NOT NULL,             -- 'claude-sonnet-4', 'gpt-4o', etc.
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    estimated_cost REAL NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT                    -- JSON: request_id, api_key_id, etc.
);

-- Periodic billing snapshots from provider APIs
CREATE TABLE billing_snapshots (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    total_cost REAL NOT NULL,
    total_tokens INTEGER,
    raw_data TEXT,                   -- Full API response for audit
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configured provider connections
CREATE TABLE providers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider TEXT NOT NULL,          -- 'anthropic', 'openai', etc.
    display_name TEXT NOT NULL,
    api_key_encrypted TEXT,          -- Encrypted at rest
    org_id TEXT,                     -- For admin APIs
    enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Alert configurations
CREATE TABLE alerts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider_id TEXT REFERENCES providers(id),
    threshold_type TEXT NOT NULL,    -- 'percentage', 'absolute', 'cost'
    threshold_value REAL NOT NULL,
    window TEXT DEFAULT 'daily',     -- 'daily', 'weekly', 'monthly'
    channel TEXT DEFAULT 'notification', -- 'notification', 'webhook', 'email'
    enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 6. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Proxy Server | Python + `aiohttp` | Async, lightweight, handles streaming |
| Backend API | Python + FastAPI | Same language as proxy, async, auto-docs |
| Database | SQLite | Local-first, zero-config, sufficient for usage logs |
| Frontend | React 18 + Vite + TypeScript | Fast, typed, huge ecosystem |
| Styling | Tailwind CSS | Rapid UI, consistent fuel-gauge theming |
| Charts | Recharts or Visx | Sparklines, usage trends |
| Scheduling | APScheduler | Python-native, simple cron-like |
| Crypto | `cryptography` (Fernet) | Encrypt API keys at rest |

---

## 7. Project Structure

```
token-tank/
├── README.md
├── ARCHITECTURE.md          # This document
├── LICENSE                  # MIT
├── .gitignore
├── backend/
│   ├── requirements.txt
│   ├── token_tank/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app entry
│   │   ├── config.py         # Settings (pydantic-settings)
│   │   ├── database.py       # SQLite + SQLAlchemy setup
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic response/request schemas
│   │   ├── crypto.py         # API key encryption
│   │   ├── proxy/
│   │   │   ├── __init__.py
│   │   │   ├── server.py     # Proxy server (aiohttp)
│   │   │   ├── router.py     # Route detection per provider
│   │   │   └── adapters/
│   │   │       ├── __init__.py
│   │   │       ├── base.py        # ProviderAdapter ABC
│   │   │       ├── anthropic.py
│   │   │       ├── openai.py
│   │   │       ├── zai.py
│   │   │       └── ollama.py
│   │   ├── pollers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py       # BillingPoller ABC
│   │   │   ├── anthropic.py
│   │   │   └── openai.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── dashboard.py  # GET /api/v1/dashboard
│   │       ├── providers.py  # CRUD providers
│   │       └── alerts.py     # CRUD alerts
│   └── tests/
│       ├── conftest.py
│       ├── test_proxy.py
│       └── test_adapters.py
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── FuelGauge.tsx       # SVG fuel gauge
│       │   ├── ProviderCard.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Settings.tsx
│       │   ├── AlertPanel.tsx
│       │   ├── UsageChart.tsx
│       │   └── BurnRate.tsx
│       ├── api/
│       │   └── client.ts
│       ├── types/
│       │   └── index.ts
│       └── styles/
│           └── global.css
└── docs/
    └── provider-pricing.md   # Pricing reference for cost estimation
```

---

## 8. Build Phases

### Phase 1: Core Infrastructure (MVP)
- [ ] SQLite database + models
- [ ] Proxy server with provider routing
- [ ] Anthropic + OpenAI adapters (proxy tracking)
- [ ] FastAPI backend with dashboard endpoint
- [ ] Basic React dashboard with fuel gauge component
- [ ] Two providers showing live data

### Phase 2: Full Provider Coverage
- [ ] Z.AI adapter
- [ ] Ollama adapter
- [ ] Billing API poller (Anthropic + OpenAI)
- [ ] Cost estimation engine
- [ ] Provider settings UI (connect/disconnect)

### Phase 3: Intelligence Layer
- [ ] Burn rate calculation (tokens/day, $/day)
- [ ] Usage forecasting (projected exhaustion)
- [ ] Alert system (thresholds, notifications)
- [ ] Historical usage charts

### Phase 4: Polish & Ship
- [ ] Production build pipeline (frontend served by backend)
- [ ] Installer / setup script
- [ ] Documentation
- [ ] Provider pricing reference
- [ ] Dark mode (dashboard looks like a car's instrument cluster at night)

### Phase 5: Browser Extension (Future)
- [ ] Chrome/Firefox extension
- [ ] Claude.ai DOM scraping for message caps
- [ ] ChatGPT DOM scraping for GPT-4 limits
- [ ] Sync with local Token Tank instance

---

## 9. Design Principles

1. **Local-first** — All data stays on the user's machine. No cloud dependency. No key custody.
2. **Transparent proxy** — The proxy must be invisible to the user's tools. Same response, same headers, same streaming. Just logged.
3. **Provider-agnostic core** — Adding a new provider = writing one adapter file. The core never changes.
4. **Fuel gauge UX** — Every metric should be visualizable as a gauge. If it can't be shown on a fuel gauge, it's secondary.
5. **Zero-config default** — Works out of the box with sensible defaults. Settings are for power users.
6. **Privacy-first** — API keys encrypted at rest. Logs contain token counts, never request/response content.

---

## 10. Open Decisions (Tabled)

| # | Decision | Options | Default |
|---|---|---|---|
| 1 | Proxy port | 8848, 3000, custom | 8848 |
| 2 | Alert delivery | macOS notifications, webhooks, email, desktop toast | macOS notifications |
| 3 | Data retention | 7/30/90/365 days | 90 days |
| 4 | Charting library | Recharts, Visx, Chart.js | Recharts |
| 5 | Deployment target | pip install, Homebrew, Docker, standalone binary | pip install + Homebrew |
