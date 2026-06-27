# ⛽ Token Tank

> **Check the Tank.** One dashboard for all your AI usage.

Token Tank is a local-first AI usage monitor that tracks token consumption, API spend, and burn rate across multiple AI providers — all displayed as fuel gauges on a single dashboard.

Each provider gets its own tank. Watch the needle drop from Full to Empty as you burn through your AI fuel.

---

## 🎯 The Problem

You've got Anthropic, OpenAI, Z.AI, MiniMax, Ollama, and LM Studio subscriptions. Each has its own dashboard, its own usage metrics, its own billing cycle. There's no single place to see:

- How much you've used today across **all** providers
- How fast you're burning through your quota
- When you'll run out
- How much you're spending in total

Token Tank fixes this.

---

## ✨ Features

- **⛽ Fuel Gauge Dashboard** — Each provider shown as a fuel gauge (F → E). Instant visual read.
- **🔌 Six Providers** — Anthropic, OpenAI, Z.AI, MiniMax, Ollama (Cloud/Pro), and LM Studio — all supported.
- **📊 Universal Token Tracking** — A local proxy intercepts every API call and counts tokens. Works for all providers, even ones without billing APIs.
- **💰 Cost Tracking** — Pulls billing data directly from providers that support it (Anthropic, OpenAI). Estimates costs for the rest.
- **🔥 Burn Rate** — Tokens/day, $/day. Know how fast you're consuming.
- **🚨 Alerts** — Notifications when usage hits 50%, 75%, 90%, or projected exhaustion.
- **📤 History & Export** — Full usage history in SQLite, exportable for deeper analysis.
- **🔒 Local-First** — All data stays on your machine. API keys encrypted at rest. No cloud, no key custody.
- **🔄 Proxy + Billing Poller** — Dual data acquisition: real-time proxy logging for all providers, plus scheduled polling of billing APIs where available.

---

## 🏗️ How It Works

```
Your AI Tools ──▶ Token Tank Proxy ──▶ Provider APIs
                        │ (port 8848)
                        ├──▶ Token Logger ──▶ SQLite
                        │
Billing APIs ──▶ Poller (every 5 min) ─┘

                        ▼
                 React Dashboard (fuel gauges)
```

1. **Proxy Layer** — Point your AI tools at `localhost:8848` instead of the real API. Token Tank forwards everything transparently and logs token counts per request (provider, model, input/output tokens, estimated cost).

2. **Billing Poller** — Where providers expose billing APIs (Anthropic, OpenAI), Token Tank polls them directly on a configurable schedule (~5 minutes) for accurate cost data.

3. **Dashboard** — React SPA showing all providers as fuel gauges with usage trends, burn rates, cost totals, and alert notifications.

---

## 🚀 Quick Start (3 Commands)

### Prerequisites
- Python 3.11+
- Node.js 20+

### Step 1 — Install & Init

```bash
cd backend
pip install -r requirements.txt
# Creates ~/.token-tank/ directory with SQLite DB and config
python -m token_tank.main --init
```

### Step 2 — Start the Proxy

```bash
uvicorn token_tank.proxy.server:app --reload --port 8000 &
# Proxy listens on localhost:8848 (not port 8000 — that's the API)
```

### Step 3 — Start the Dashboard

```bash
cd frontend
npm install && npm run dev
# Dashboard at http://localhost:5173
```

### Connect a Provider (in 4 sub-steps)
1. Open `http://localhost:5173`
2. Go to **Settings → Add Provider**
3. Enter your API key (encrypted locally with Fernet)
4. Point an AI tool's `OPENAI_API_BASE_URL` (or equivalent) to `http://localhost:8848`
5. Watch the gauge move

---

## 📋 Supported Providers

| Provider | Proxy Tracking | Billing API | Cost Estimation | Local Port | Models |
|---|---|---|---|---|---|
| **Anthropic** | ✅ All Claude models | ✅ Admin API (org-level reports) | ✅ Sonnet 4, Opus 4, Haiku 3.5 | `localhost:8848` | claude-sonnet-4, claude-opus-4, claude-haiku-3.5 |
| **OpenAI** | ✅ All models (GPT, o1, o3) | ✅ Billing API | ✅ GPT-4o, GPT-4-turbo, o1, o3 | `localhost:8848` | gpt-4o, gpt-4o-mini, o1, o3 |
| **Z.AI** | ✅ GLM models (proxy only) | ❌ No public billing API | ✅ GLM-5.2, GLM-4-plus, GLM-4-air | `localhost:8848` | glm-5.2, glm-4-plus, glm-4-air |
| **MiniMax** | ✅ MiniMax-M3 (proxy only) | ❌ No public billing API | ✅ abab6.5, abab5.5 (flat rate) | `localhost:8848` | abab6.5-chat, abab5.5-chat |
| **Ollama (Cloud/Pro)** | ✅ llama, Qwen, DeepSeek (proxy only) | ❌ No public billing API | ✅ GPU-time pricing (L1-L4 tiers) | `localhost:8848` | llama3.3, qwen2.5, deepseek-r1 |
| **LM Studio** | ✅ Any local model (proxy only) | ❌ N/A — runs locally free | ✅ Free (zero cost, local GPU/CPU) | `localhost:1234` | Any Ollama/llama.cpp model |

---

## 📐 Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                     USER'S MACHINE                             │
│                                                                │
│  ┌───────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ AI Tools  │───▶│ Token Tank   │───▶│ Provider APIs     │  │
│  │ (Cursor,  │    │ Proxy Server │    │                   │  │
│  │ Claude    │    │ (port 8848)  │    │                   │  │
│  │ Code, etc)│    └──────┬───────┘    └───────────────────┘  │
│  └───────────┘            │                                   │
│                           │ token log records                 │
│                           ▼                                   │
│  ┌───────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ Billing   │───▶│ Billing      │    │                   │  │
│  │ API       │    │ Poller       │    │ (skips silently   │  │
│  │ (cron)    │    │ (every 5min) │    │  if no billing    │  │
│  └───────────┘    └──────┬───────┘    │  for provider)    │  │
│                          │            │                   │  │
│                          ▼            │                   │  │
│                   ┌──────────────┐    │                   │  │
│                   │ SQLite DB    │    │                   │  │
│                   │ usage.log +  │    │                   │  │
│                   │ billing_data │    │                   │  │
│                   └──────┬───────┘    │                   │  │
│                          │            │                   │  │
│                          ▼            │                   │  │
│                   ┌──────────────┐    │                   │  │
│                   │ FastAPI      │    │                   │  │
│                   │ Backend      │    │                   │  │
│                   │ (port 8000)  │    │                   │  │
│                   └──────┬───────┘    │                   │  │
│                          │            │                   │  │
│                          ▼            │                   │  │
│                   ┌──────────────┐    │                   │  │
│                   │ React        │    │                   │  │
│                   │ Dashboard    │    │                   │  │
│                   │ (port 5173)  │    │                   │  │
│                   └──────────────┘    └───────────────────┘  │
│                                                                │
└───────────────────────────────────────────────────────────────┘

Key: Dual data acquisition strategy
  Layer 1 — Proxy Gateway (ALL providers): tracks tokens per request in real time
  Layer 2 — Billing Poller (selected): pulls official cost data from Anthropic/OpenAI
```

**Why WAL mode?** SQLite's Write-Ahead Logging (WAL) enables concurrent reads and writes — the proxy logs incoming requests while the dashboard serves usage data simultaneously, without lock contention.

---

## 🏭 Development

### Project Structure

```
token-tank/
├── README.md                  # This file
├── ARCHITECTURE.md            # Full system design (locked)
├── LICENSE                    # MIT
├── backend/
│   ├── requirements.txt
│   └── token_tank/
│       ├── main.py            # FastAPI app entry (port 8000)
│       ├── config.py          # Settings (pydantic-settings)
│       ├── database.py        # SQLite + SQLAlchemy setup (WAL mode)
│       ├── models.py          # ORM models
│       ├── schemas.py         # Pydantic request/response schemas
│       ├── crypto.py          # Fernet API key encryption
│       ├── alert_engine.py    # Alert threshold logic
│       ├── analytics.py       # Burn rate + forecasting
│       ├── proxy/
│       │   ├── server.py      # aiohttp proxy (port 8848)
│       │   ├── billing_poller.py  # Scheduled billing API poller
│       │   └── adapters/
│       │       ├── base.py        # ProviderAdapter ABC
│       │       ├── anthropic.py   # Claude models
│       │       ├── openai.py      # GPT / o1 / o3
│       │       ├── zai.py         # GLM models (Z.AI)
│       │       ├── minimax.py     # MiniMax abab models
│       │       ├── ollama.py      # Ollama Cloud/Pro
│       │       └── lmstudio.py    # Local LM Studio (free)
│       └── routers/
│           ├── dashboard.py     # GET /api/v1/dashboard
│           ├── providers.py     # CRUD providers
│           └── alerts.py        # Alert management
├── frontend/
│   ├── package.json
│   └── src/
│       ├── components/
│       │   ├── FuelGauge.tsx    # SVG fuel gauge (F → E)
│       │   ├── ProviderCard.tsx
│       │   ├── Dashboard.tsx
│       │   └── ...
├── docs/
│   ├── provider-setup.md      # Step-by-step for each provider
│   └── pricing-reference.md   # Per-provider pricing tables
└── CONTRIBUTING.md            # How to add a new provider adapter
```

### Running Tests

```bash
cd backend
pytest tests/ -v
```

### Adding a Provider (5 steps)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full step-by-step guide.

1. Copy `adapters/anthropic.py` as your template
2. Implement `matches()`, `parse_usage()`, and `estimate_cost()`
3. Register in `adapters/__init__.py` (order matters!)
4. Add a test fixture to `tests/fixtures/responses.py`
5. Add a test class to `tests/test_adapters.py`

---

## 📜 License

MIT — see [LICENSE](LICENSE)

<div align="center">

**⛽ Token Tank — Know your fuel level.**

</div>
