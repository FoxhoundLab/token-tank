# ⛽ Token Tank

> **Check the Tank.** One dashboard for all your AI usage.

Token Tank is a local-first AI usage monitor that tracks token consumption, API spend, and burn rate across multiple AI providers — all displayed as fuel gauges on a single dashboard.

Each provider gets its own tank. Watch the needle drop from Full to Empty as you burn through your AI fuel.

---

## 🎯 The Problem

You've got Anthropic, OpenAI, Z.AI, and Ollama subscriptions. Each has its own dashboard, its own usage metrics, its own billing cycle. There's no single place to see:

- How much you've used today across **all** providers
- How fast you're burning through your quota
- When you'll run out
- How much you're spending in total

Token Tank fixes this.

---

## ✨ Features

- **⛽ Fuel Gauge Dashboard** — Each provider shown as a fuel gauge (F → E). Instant visual read.
- **🔌 Multi-Provider** — Anthropic, OpenAI, Z.AI, Ollama, and any provider with an OpenAI-compatible API.
- **📊 Universal Token Tracking** — A local proxy intercepts every API call and counts tokens. Works for all providers, even ones without billing APIs.
- **💰 Cost Tracking** — Pulls billing data directly from providers that support it (Anthropic, OpenAI). Estimates costs for the rest.
- **🔥 Burn Rate** — Tokens/day, $/day. Know how fast you're consuming.
- **🚨 Alerts** — Notifications when usage hits 50%, 75%, 90%, or projected exhaustion.
- **🔒 Local-First** — All data stays on your machine. API keys encrypted at rest. No cloud, no key custody.

---

## 🏗️ How It Works

```
Your AI Tools ──▶ Token Tank Proxy ──▶ Provider APIs
                        │
                        ├──▶ Token Logger ──▶ SQLite
                        │
Billing APIs ──▶ Poller ─┘
                                                
                        ▼
                 React Dashboard (fuel gauges)
```

1. **Proxy Layer** — Point your AI tools at `localhost:8848` instead of the real API. Token Tank forwards everything transparently and logs token counts.
2. **Billing Layer** — Where providers expose billing APIs (Anthropic, OpenAI), Token Tank polls them directly for accurate cost data.
3. **Dashboard** — React SPA showing all providers as fuel gauges with usage trends, burn rates, and alerts.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn token_tank.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Connect a Provider
1. Open `http://localhost:5173`
2. Go to Settings → Add Provider
3. Enter your API key (encrypted locally)
4. Point your AI tool to `localhost:8848` as the API base URL
5. Watch the gauge move

---

## 📋 Supported Providers

| Provider | Proxy Tracking | Billing API | Status |
|---|---|---|---|
| Anthropic | ✅ | ✅ Admin API | Phase 1 |
| OpenAI | ✅ | ✅ Billing API | Phase 1 |
| Z.AI | ✅ | ❌ | Phase 2 |
| Ollama | ✅ | ❌ | Phase 2 |
| Custom | ✅ | — | Phase 3 |

---

## 📖 Documentation

- [Architecture Specification](ARCHITECTURE.md) — Full system design, database schema, build phases
- Provider pricing reference coming soon

---

## 📜 License

MIT — see [LICENSE](LICENSE)

---

## 🛣️ Roadmap

- **Phase 1**: Core proxy + Anthropic/OpenAI + fuel gauge UI
- **Phase 2**: Z.AI + Ollama + billing poller + cost estimation
- **Phase 3**: Burn rate, forecasting, alert system
- **Phase 4**: Production packaging, installer, docs
- **Phase 5**: Browser extension for subscription cap tracking

---

<div align="center">

**⛽ Token Tank — Know your fuel level.**

</div>
