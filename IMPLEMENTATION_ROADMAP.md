# ⛽ Token Tank — Implementation Roadmap

> **Car instrument panel for your AI stack.**
>
> Full build roadmap from scaffold to shipped product.

**Created:** June 26, 2026  
**Status:** Phase 0 complete (scaffold + wireframe)  
**Repo:** [FoxhoundLab/token-tank](https://github.com/FoxhoundLab/token-tank)

---

## Architecture Summary (Locked)

| Layer | Tech | Role |
|---|---|---|
| Proxy Server | Python + aiohttp | Intercepts API calls, logs tokens |
| Backend API | Python + FastAPI | Dashboard data, provider CRUD, alerts |
| Database | SQLite | Usage records, billing snapshots, providers, alerts |
| Frontend | React 18 + Vite + TypeScript + Tailwind | Fuel gauge dashboard |
| Encryption | Fernet (AES-128) | API keys at rest |

**Data Strategy:** Two layers — Proxy (universal token tracking) + Billing API Poller (spend data where available).

**Three Card Models:**
1. Subscription (Anthropic, Z.AI, Ollama Pro) → usage windows + reset timers
2. API (MiniMax) → spend tracking + prepaid balance
3. Local (LM Studio) → token count only, ∞ unlimited

---

## Phase Overview

| Phase | Name | Sprints | Focus | Status |
|---|---|---|---|---|
| 0 | Scaffold | — | Repo, architecture, wireframe | ✅ Complete |
| 1 | Core Engine | 1A–1D | Proxy, adapters, backend, dashboard UI | 🔲 Next |
| 2 | Full Providers | 2A–2C | MiniMax, LM Studio, billing poller | 🔲 |
| 3 | Intelligence | 3A–3C | Burn rate, forecasting, alerts | 🔲 |
| 4 | Ship It | 4A–4C | Production build, packaging, docs | 🔲 |
| 5 | Extended | 5A–5C | Browser extension, cost optimizer, mobile | 🔲 Future |

---

## Phase 1: Core Engine

> **Goal:** Working end-to-end system. Proxy forwards real API calls, logs tokens, dashboard shows live fuel gauges. Two providers live (Anthropic + Z.AI).

### Sprint 1A: Proxy Server

**Deliverable:** Transparent proxy on `localhost:8848` that forwards requests to Anthropic and Z.AI, parses token counts from responses, writes to SQLite.

| # | Task | Files | Detail |
|---|---|---|---|
| 1 | Install deps + verify import | `requirements.txt`, `backend/` | `pip install -r requirements.txt`, `python -c "import token_tank.main"` |
| 2 | Wire up SQLite tables on boot | `database.py`, `models.py` | `Base.metadata.create_all()` on startup, verify tables exist |
| 3 | Implement proxy route detection | `proxy/router.py` | Match path → adapter, forward to real API base URL |
| 4 | Implement request forwarding | `proxy/server.py` | aiohttp handler: receive → forward → return transparently |
| 5 | Anthropic adapter — parse usage | `proxy/adapters/anthropic.py` | Parse `usage.input_tokens` / `usage.output_tokens` from response JSON |
| 6 | Z.AI adapter — parse usage | `proxy/adapters/zai.py` | Parse `usage.prompt_tokens` / `usage.completion_tokens` |
| 7 | Usage logging to SQLite | `proxy/server.py`, `models.py` | Write `UsageRecord` on each response: provider, model, tokens, cost estimate |
| 8 | Streaming response passthrough | `proxy/server.py` | Handle `stream: true` responses without breaking |
| 9 | Startup script | `scripts/run_proxy.sh` | Launch proxy on port 8848 |
| 10 | Integration test — real API call | `tests/test_proxy.py` | Forward a real Anthropic request, verify token log in DB |

**Success Gate:** Send a real Claude API request through `localhost:8848`, get correct response, see token record in SQLite.

**Test command:** `curl localhost:8848/v1/messages -H "x-api-key: $KEY" -H "content-type: application/json" -d '{"model":"claude-sonnet-4-20250514","max_tokens":100,"messages":[{"role":"user","content":"Say hello"}]}'`

**Verification:** `sqlite3 ~/.token-tank/usage.db "SELECT * FROM usage_records ORDER BY timestamp DESC LIMIT 1;"`

---

### Sprint 1B: Backend API

**Deliverable:** FastAPI server on `:8000` serving real dashboard data from the usage database.

| # | Task | Files | Detail |
|---|---|---|---|
| 1 | Dashboard endpoint — real queries | `routers/dashboard.py` | Aggregate from `usage_records`: today/month tokens + cost, per provider |
| 2 | Provider CRUD — wire encryption | `routers/providers.py`, `crypto.py` | POST encrypts key → DB, GET returns without key, DELETE removes |
| 3 | Usage history endpoint | `routers/providers.py` | `GET /api/v1/providers/{id}/usage` — time series for charts |
| 4 | Cost calculation engine | `proxy/adapters/*.py` | Per-model pricing tables → `estimate_cost()` on each request |
| 5 | Pydantic response schemas | `schemas.py` | Match wireframe data shapes: `ProviderSummary`, `DashboardData` |
| 6 | CORS + proxy middleware | `main.py` | Allow `localhost:5173` for dev, configure properly |
| 7 | Startup script | `scripts/run_backend.sh` | Launch uvicorn on port 8000 |
| 8 | API tests | `tests/test_api.py` | Hit `/dashboard`, `/providers` with seeded DB |

**Success Gate:** `GET /api/v1/dashboard` returns real usage data after proxy has logged requests. `POST /api/v1/providers` encrypts and stores a key.

---

### Sprint 1C: Dashboard UI — Fuel Gauges

**Deliverable:** React dashboard matching wireframe v5, connected to real backend data. Fuel gauges render live.

| # | Task | Files | Detail |
|---|---|---|---|
| 1 | Install deps + verify build | `frontend/` | `npm install`, `npm run dev` boots on 5173 |
| 2 | FuelGauge component — production | `components/FuelGauge.tsx` | SVG gauge with needle, zones, glow. Props: `pct`, `color`, `label` |
| 3 | ProviderCard — subscription model | `components/ProviderCard.tsx` | Gauge + usage windows (5hr/weekly) + reset countdowns + stats + burn rate |
| 4 | Dashboard grid + auto-refresh | `components/Dashboard.tsx` | Poll `/api/v1/dashboard` every 5s, render provider cards |
| 5 | API client | `api/client.ts` | Fetch dashboard, providers. Error handling, loading states |
| 6 | TypeScript types | `types/index.ts` | Match backend schemas exactly |
| 7 | Tailwind setup | `tailwind.config.js`, `styles/` | Dark instrument panel theme from wireframe |
| 8 | Countdown timer component | `components/Countdown.tsx` | Live ticking "2h 14m until reset" — takes reset timestamp, renders remaining |
| 9 | Color logic | `utils/colors.ts` | Green (<50%), amber (50-85%), red (85%+) for fills, text, needles |
| 10 | Responsive grid | `Dashboard.tsx` | Auto-fill minmax(350px, 1fr), mobile collapses to 1 column |

**Success Gate:** Open `localhost:5173`, see fuel gauges rendering real data from the backend. Gauges update when new requests flow through the proxy.

---

### Sprint 1D: Settings + Provider Connection

**Deliverable:** Working settings page — add/remove providers, see proxy config, configure display name.

| # | Task | Files | Detail |
|---|---|---|---|
| 1 | Settings page — provider list | `components/Settings.tsx` | List connected providers, Configure/Disconnect buttons |
| 2 | Add provider form | `components/Settings.tsx` | Provider picker grid, display name, API key, org ID |
| 3 | Provider picker | `components/ProviderPicker.tsx` | 5 tiles: Anthropic, MiniMax, Z.AI, Ollama, LM Studio |
| 4 | Proxy config display | `components/Settings.tsx` | Show `localhost:8848`, auto-start toggle, retention, poll interval |
| 5 | Privacy panel | `components/Settings.tsx` | Encryption badge, content logging toggle, telemetry toggle |
| 6 | Form validation | `utils/validation.ts` | API key format checks per provider, required fields |
| 7 | Loading/error states | `components/Settings.tsx` | Handle backend down, connection errors, bad keys |

**Success Gate:** User can add Anthropic provider via UI, see it in the list, disconnect it. Provider appears in dashboard.

---

**Phase 1 Exit Criteria:**
- [ ] Proxy forwards Anthropic + Z.AI API calls transparently
- [ ] Token usage logged to SQLite on every request
- [ ] Dashboard shows live fuel gauges with real data
- [ ] Settings page manages provider connections
- [ ] Countdown timers tick live
- [ ] Cost estimation per request working
- [ ] `curl` through proxy → response → token in DB → gauge moves

---

## Phase 2: Full Provider Coverage

> **Goal:** All 5 providers live. MiniMax (API spend), Ollama Pro (subscription), LM Studio (local). Billing API poller for Anthropic.

### Sprint 2A: MiniMax + Ollama Adapters

| # | Task | Detail |
|---|---|---|
| 1 | MiniMax adapter — proxy routing | Route `/v1/chat/completions` → MiniMax API, parse tokens |
| 2 | MiniMax pricing table | Per-model $/1M tokens from MiniMax docs |
| 3 | MiniMax card — API spend model | Gauge shows balance, spend tiles (today/month), no usage windows |
| 4 | Ollama adapter — proxy routing | Route `/api/chat` → `ollama.com/api` (cloud), parse `eval_count` / `prompt_eval_count` |
| 5 | Ollama pricing estimation | GPU-time tiers (L1-L4), approximate $/token conversion |
| 6 | Ollama card — subscription model | Same as Anthropic card (usage windows + resets) |

**Success Gate:** MiniMax and Ollama traffic flows through proxy, tokens logged, cards render on dashboard.

---

### Sprint 2B: LM Studio (Local)

| # | Task | Detail |
|---|---|---|
| 1 | LM Studio adapter | Route to `localhost:1234`, parse token counts from response |
| 2 | Local detection | No API key required, auto-detect if LM Studio running |
| 3 | LM Studio card — local model | Gauge pinned at Full (∞), $0.00 everywhere, active models list |
| 4 | Active models endpoint | Query LM Studio `/v1/models` to populate active models list |
| 5 | Local toggle in settings | Connect/disconnect without API key — just needs host:port |

**Success Gate:** LM Studio requests tracked, card shows ∞ gauge with real token counts, active models listed.

---

### Sprint 2C: Billing API Poller

| # | Task | Detail |
|---|---|---|
| 1 | Poller base class | `BillingPoller` ABC: schedule, fetch, store snapshot |
| 2 | Anthropic billing poller | Admin API: `GET /v1/organizations/{org}/usage/reports` + `/cost/reports` |
| 3 | Billing snapshots in DB | Write `BillingSnapshot` records, merge with proxy data for cost accuracy |
| 4 | APScheduler integration | Background scheduler in FastAPI lifespan, every 5 min |
| 5 | Cost reconciliation | Merge proxy-tracked costs with billing API costs, flag discrepancies |
| 6 | Provider status indicators | Show which providers have billing API vs proxy-only tracking |

**Success Gate:** Anthropic billing data pulled every 5 min, dashboard cost figures match actual Anthropic billing.

---

**Phase 2 Exit Criteria:**
- [ ] All 5 providers tracked: Anthropic, MiniMax, Z.AI, Ollama Pro, LM Studio
- [ ] Three card models rendering correctly (subscription, API, local)
- [ ] Billing poller running for Anthropic
- [ ] Cost estimates within 5% of actual billing

---

## Phase 3: Intelligence Layer

> **Goal:** The dashboard tells you something useful, not just raw numbers. Burn rates, projections, alerts that actually fire.

### Sprint 3A: Burn Rate + Forecasting

| # | Task | Detail |
|---|---|---|
| 1 | Burn rate calculation | Tokens/hr, $/hr — rolling average from last N hours |
| 2 | Exhaustion projection | "At current burn rate, weekly quota exhausted in 4h 22m" |
| 3 | Trend detection | Increasing/decreasing/stable burn rate vs yesterday, last week |
| 4 | Sparkline charts | Mini SVG line chart per provider showing 7-day token trend |
| 5 | Fuel level calculation | Convert usage % → gauge needle position with smart thresholds |
| 6 | Usage window tracking | Track 5hr window start/reset times, weekly window boundaries |

**Success Gate:** Each card shows burn rate, projected exhaustion time, and a 7-day sparkline.

---

### Sprint 3B: Alert System

| # | Task | Detail |
|---|---|---|
| 1 | Alert evaluation engine | Check thresholds every refresh cycle, fire when crossed |
| 2 | macOS notification delivery | `osascript -e 'display notification'` for native alerts |
| 3 | Alert types | Percentage threshold, absolute cost, burn rate spike, projected exhaustion |
| 4 | Alert CRUD UI | Alerts page from wireframe: create, toggle, delete, last-triggered |
| 5 | Alert history log | Store fired alerts in `alert_history` table, show in UI |
| 6 | Smart suppression | Don't re-fire same alert within cooldown window (15 min default) |

**Success Gate:** Set a 75% threshold alert on Z.AI, burn through quota, get macOS notification when it crosses.

---

### Sprint 3C: History + Analytics

| # | Task | Detail |
|---|---|---|
| 1 | Usage history view | Per-provider drill-down: 7d/30d/90d charts, model breakdown |
| 2 | Cost breakdown | Per-model cost pie chart, cost-per-day bar chart |
| 3 | Cross-provider comparison | Bar chart comparing token spend across all providers |
| 4 | Data export | Export usage data as CSV/JSON |
| 5 | Time-range filtering | Filter dashboard by day/week/month/all-time |

**Success Gate:** Click a provider card → see detailed history with charts and model breakdowns.

---

**Phase 3 Exit Criteria:**
- [ ] Burn rates calculated and displayed
- [ ] Exhaustion projections accurate
- [ ] Alerts fire via macOS notifications
- [ ] Provider detail views with charts
- [ ] CSV export working

---

## Phase 4: Ship It

> **Goal:** Token Tank is installable, documented, and usable by someone who isn't Snake.

### Sprint 4A: Production Build

| # | Task | Detail |
|---|---|---|
| 1 | Frontend production build | `npm run build` → `dist/`, served by FastAPI static files |
| 2 | Single-command launcher | `token-tank` CLI command starts proxy + backend + serves frontend |
| 3 | Process management | Proxy and backend as managed subprocesses, graceful shutdown |
| 4 | Config file support | `~/.token-tank/config.toml` for persistent settings |
| 5 | First-run setup wizard | Detect installed providers, offer to auto-configure |
| 6 | Auto-detect LM Studio | Probe `localhost:1234` on startup, auto-add if running |

**Success Gate:** Run one command → browser opens to working dashboard.

---

### Sprint 4B: Packaging + Distribution

| # | Task | Detail |
|---|---|---|
| 1 | pip installable package | `pyproject.toml`, `pip install token-tank` |
| 2 | Homebrew formula | `brew install foxhoundlab/tap/token-tank` |
| 3 | Binary distribution | PyInstaller or Nuitka standalone for macOS |
| 4 | `.env.example` + setup docs | Clear configuration documentation |
| 5 | Auto-update check | Check GitHub releases for new versions |

**Success Gate:** `pip install token-tank && token-tank` works on a clean machine.

---

### Sprint 4C: Documentation + Polish

| # | Task | Detail |
|---|---|---|
| 1 | User guide | How to connect each provider, point tools at proxy |
| 2 | Provider setup guides | Step-by-step for Claude Code, Cursor, Hermes, etc. |
| 3 | Provider pricing reference | `docs/provider-pricing.md` — all pricing tables documented |
| 4 | README polish | Screenshots, GIFs, install instructions, feature list |
| 5 | Contributing guide | How to add a new provider adapter |
| 6 | Dark mode refinement | Fine-tune colors, contrast, glow effects for production |
| 7 | Error handling pass | Graceful degradation when providers are down, DB locked, etc. |
| 8 | Performance audit | Proxy latency benchmarks, DB query optimization, frontend bundle size |

**Success Gate:** A new user can install, connect a provider, and see their dashboard within 5 minutes.

---

**Phase 4 Exit Criteria:**
- [ ] One-command install and launch
- [ ] pip + Homebrew distribution
- [ ] Documentation complete
- [ ] Frontend served by backend (no separate dev server needed)
- [ ] Works on clean macOS install

---

## Phase 5: Extended Features (Future)

> **Goal:** Beyond MVP. The features that make Token Tank a category leader.

### Sprint 5A: Browser Extension

| # | Task | Detail |
|---|---|---|
| 1 | Chrome/Firefox extension | Manifest v3, content scripts for claude.ai and chatgpt.com |
| 2 | Claude.ai DOM scraping | Read message count / usage indicator from Claude web UI |
| 3 | ChatGPT DOM scraping | Read GPT-4 usage limits from ChatGPT web UI |
| 4 | Extension → local sync | POST captured subscription data to Token Tank backend |
| 5 | True subscription caps | Finally show "Claude Pro: 47/100 messages" from real data |

**Deliverable:** The subscription caps that no API can provide — captured from the actual web UIs.

---

### Sprint 5B: Cost Optimizer

| # | Task | Detail |
|---|---|---|
| 1 | Provider comparison | "This task cost $0.03 on Z.AI vs $0.12 on Anthropic" |
| 2 | Smart routing suggestions | "Switch to Ollama Pro for code tasks — 60% cheaper" |
| 3 | Monthly cost projection | Based on current burn rates, project end-of-month spend |
| 4 | Budget goals | Set monthly budget, get warnings at 50/75/90% |
| 5 | Idle provider detection | "You're paying for Ollama Pro but haven't used it in 7 days" |

**Deliverable:** Token Tank doesn't just show data — it tells you how to save money.

---

### Sprint 5C: Mobile + Cloud

| # | Task | Detail |
|---|---|---|
| 1 | Responsive PWA | Installable on mobile, view dashboard on phone |
| 2 | Cloud sync (optional, paid) | Encrypted usage data sync across devices |
| 3 | Team dashboard | Shared view for teams — see everyone's AI usage |
| 4 | API key vault | Encrypted cross-device key sync (opt-in, zero-knowledge) |
| 5 | Webhook integrations | Slack/Discord alerts, Zapier integration |

**Deliverable:** Token Tank works everywhere, syncs optionally, and serves teams.

---

## Open Decisions (Tabled)

| # | Decision | Options | Default | Resolve By |
|---|---|---|---|---|
| 1 | Proxy port | 8848, 3000, custom | 8848 | Phase 1A |
| 2 | Alert delivery | macOS notifications, webhooks, email | macOS first | Phase 3B |
| 3 | Data retention | 7/30/90/365 days | 90 days | Phase 4A |
| 4 | Charting library | Recharts, Visx, Chart.js, custom SVG | Custom SVG first | Phase 3A |
| 5 | Distribution | pip, Homebrew, binary | pip + Homebrew | Phase 4B |
| 6 | Monetization | OSS free, freemium cloud sync, team plans | OSS first, cloud Phase 5C | Phase 5C |
| 7 | Streaming support | Full passthrough vs buffered parse | Passthrough + post-parse | Phase 1A |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Provider changes API response format | Medium | High | Adapter unit tests with real fixtures, versioned adapters |
| Streaming responses break token parsing | High | Medium | Parse from final response chunk or response headers |
| CORS blocks browser → provider calls | N/A | N/A | Not applicable — proxy handles all calls server-side |
| SQLite write contention (proxy + poller) | Low | Medium | WAL mode, connection pooling, retry on busy |
| Provider doesn't expose usage data (Z.AI, Ollama) | Known | Medium | Proxy captures per-request — already the fallback |
| Subscription window detection (5hr reset) | Hard | High | Track first-request timestamp per window, infer reset time |
| API key security | Low | Critical | Fernet encryption at rest, never logged, memory-only decryption |

---

## Sprint Execution Rules

1. **One sprint at a time** — finish 1A before starting 1B
2. **Backend first** — get the data flowing before building UI for it
3. **Real API calls for testing** — no mocks for proxy/adapters, only real requests prove it works
4. **Commit per task** — each numbered task gets its own commit
5. **Verify before claiming done** — `sqlite3` queries, `curl` tests, browser screenshots
6. **Cost tracking** — every real API call during dev goes through the proxy and is logged

---

## Estimated Timeline

| Phase | Sprints | Est. Time | Notes |
|---|---|---|---|
| Phase 1 | 4 sprints (1A–1D) | 1–2 weeks | Core engine, MVP |
| Phase 2 | 3 sprints (2A–2C) | 1 week | All providers online |
| Phase 3 | 3 sprints (3A–3C) | 1–2 weeks | Intelligence + alerts |
| Phase 4 | 3 sprints (4A–4C) | 1 week | Ship it |
| Phase 5 | 3 sprints (5A–5C) | Future | Post-launch features |

**MVP (Phase 1+2):** ~2–3 weeks  
**Full product (Phase 1–4):** ~4–6 weeks  
**Extended (Phase 5):** Ongoing

---

*⛽ Token Tank — Know your fuel level.*
