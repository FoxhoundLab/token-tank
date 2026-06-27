# Token Tank Architecture

How the pieces fit together.

---

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Your Machine                           │
│                                                              │
│  ┌──────────────┐                                            │
│  │ AI Tool      │ Claude Code, Hermes, curl, OpenAI SDK...   │
│  │ (client)     │                                            │
│  └──────┬───────┘                                            │
│         │ HTTP                                               │
│         ▼                                                    │
│  ┌────────────────────────────┐                              │
│  │ Token Tank Proxy           │ localhost:8848              │
│  │ (aiohttp)                  │                              │
│  │ ┌────────────────────────┐ │                              │
│  │ │ Adapter Registry       │ │ Anthropic, Z.AI, MiniMax,   │
│  │ │ matches path → adapter │ │ OpenAI, Ollama, LM Studio    │
│  │ └────────┬───────────────┘ │                              │
│  │          │                  │                              │
│  │          ▼                  │                              │
│  │ ┌────────────────────────┐ │                              │
│  │ │ Forward + parse usage  │ │ transparently forwards;     │
│  │ │ response body         │ │ parses token counts          │
│  │ └────────┬───────────────┘ │                              │
│  └──────────┼──────────────────┘                              │
│             │ HTTPS                                           │
│             ▼                                                 │
│  ┌──────────────────────────────────────┐                    │
│  │ External Provider APIs               │                    │
│  │ (api.anthropic.com, api.z.ai, ...)  │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│         ┌─────────────────────────────────┐                   │
│         │ SQLite Database                 │                  │
│         │ ~/.token-tank/usage.db         │                  │
│         │ (WAL mode for concurrency)     │                  │
│         │ ┌─────────────────────────────┐ │                  │
│         │ │ usage_records               │ │ proxy writes     │
│         │ │ billing_snapshots           │ │ poller writes    │
│         │ │ providers                   │ │ UI reads         │
│         │ │ alerts + alert_history      │ │                  │
│         │ └─────────────────────────────┘ │                  │
│         └──────────────┬──────────────────┘                   │
│                        │                                     │
│  ┌─────────────────────▼──────────────────┐                 │
│  │ FastAPI Backend                         │ localhost:8000  │
│  │ ┌─────────────────────────────────────┐ │                 │
│  │ │ Dashboard endpoint                  │ │                 │
│  │ │ Providers CRUD                      │ │                 │
│  │ │ Usage history endpoint              │ │                 │
│  │ │ Alert evaluation + history          │ │                 │
│  │ │ CSV/JSON export                     │ │                 │
│  │ │ Cross-provider comparison           │ │                 │
│  │ └─────────────────────────────────────┘ │                 │
│  │ ┌─────────────────────────────────────┐ │                 │
│  │ │ Billing Poller (APScheduler)        │ │ every 5 min    │
│  │ │ Anthropic admin API → snapshot      │ │                 │
│  │ └─────────────────────────────────────┘ │                 │
│  └─────────────────────┬──────────────────┘                 │
│                        │                                     │
│  ┌─────────────────────▼──────────────────┐                 │
│  │ React Dashboard (or built dist/)       │ localhost:5173  │
│  │ - Fuel gauges (SVG)                     │ (dev) / :8000  │
│  │ - Sparkline charts                      │ (production)    │
│  │ - Alert management                      │                 │
│  │ - Provider picker                       │                 │
│  │ - Settings (config, privacy)            │                 │
│  └────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

1. **Tool makes API call** → routes to `localhost:8848` (Token Tank proxy)
2. **Proxy matches path** → adapter registry picks the right adapter (Anthropic, Z.AI, etc.)
3. **Proxy forwards request** → upstream provider API
4. **Provider returns response** → proxy parses `usage.input_tokens` / `usage.output_tokens`
5. **Proxy logs to SQLite** → `usage_records` table
6. **Dashboard polls backend** → reads `usage_records` via FastAPI
7. **Billing poller** (background, every 5 min) → hits Anthropic admin API → stores `billing_snapshots`
8. **Alert engine** (background, every refresh cycle) → checks thresholds → fires macOS notification + stores `alert_history`

---

## Concurrency: SQLite WAL Mode

Token Tank uses **Write-Ahead Logging (WAL)** for SQLite:

- **Proxy writes** (high frequency): `usage_records` inserts on every API call
- **Poller reads/writes** (every 5 min): `billing_snapshots` inserts
- **Dashboard reads** (every 5s): aggregates + joins

WAL allows the proxy to write while the dashboard reads without blocking. The `busy_timeout=5000` setting means concurrent writes wait up to 5 seconds before failing.

---

## File Layout

```
token-tank/
├── backend/
│   ├── token_tank/
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # Settings + TOML
│   │   ├── cli.py               # CLI entry (token-tank)
│   │   ├── wizard.py            # First-run setup
│   │   ├── analytics.py         # Burn rate, forecasting
│   │   ├── alert_engine.py      # Threshold evaluation
│   │   ├── billing_poller.py    # APScheduler background job
│   │   ├── database.py          # SQLite + WAL
│   │   ├── models.py            # SQLAlchemy ORM
│   │   ├── schemas.py           # Pydantic
│   │   ├── crypto.py            # Fernet encryption
│   │   ├── routers/             # API endpoints
│   │   └── proxy/               # aiohttp + adapters
│   └── tests/                   # pytest suite
├── frontend/
│   ├── src/                     # React + Vite
│   └── dist/                    # Production build
├── extension/                   # Browser extension (MV3)
├── docs/                        # Documentation
├── scripts/                     # run_proxy.sh, run_backend.sh
├── pyproject.toml               # pip package metadata
└── .env.example                 # Environment template
```

---

## Single-Process Deployment

`python -m token_tank` runs **everything in one process**:
- aiohttp proxy on `:8848`
- FastAPI backend on `:8000`
- APScheduler billing poller (background)
- Static file serving for the React dashboard (when built)

For high-traffic deployments, split into separate processes using `scripts/run_proxy.sh` and `scripts/run_backend.sh`.
