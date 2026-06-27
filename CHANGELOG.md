# Changelog

All notable changes to Token Tank are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-06-27

First public release candidate. Six providers, full proxy + billing + analytics
stack, single-command launcher, and a fuel-gauge dashboard.

### Added
- **Core proxy** (`localhost:8848`) — transparent forwarding with SSE/streaming
  passthrough, shared `aiohttp` session, and connection pooling.
- **Six provider adapters** — Anthropic, OpenAI, Z.AI, MiniMax, Ollama, LM Studio,
  each with `matches()` / `parse_usage()` / `estimate_cost()`.
- **FastAPI backend** (`localhost:8000`) — dashboard, providers, alerts, and
  extension routers; production frontend served from `frontend/dist/` when present.
- **Analytics** — burn rate (tokens/hr, $/hr), trend detection, exhaustion
  projection, 7-day sparkline, and 5-hour / weekly usage windows.
- **Alert engine** — percentage / cost / absolute thresholds, macOS notifications
  via `osascript`, a 15-minute cooldown, and an alert history table.
- **Billing poller** — APScheduler-driven polling of the Anthropic admin API
  (5-minute interval) with SQLite WAL mode for proxy + poller concurrency.
- **History & export** — daily totals, per-model breakdown, CSV/JSON export, and
  cross-provider comparison.
- **Single-command launcher** — `python -m token_tank` / `token-tank` CLI with
  `start` / `stop` / `status` / `init` subcommands, a TOML config at
  `~/.token-tank/config.toml`, a first-run wizard, and LM Studio auto-detection.
- **Browser extension (MV3 scaffold)** — captures subscription caps from
  claude.ai and chatgpt.com and posts them to the local-only ingest endpoint.
- **Docs** — README, CONTRIBUTING, architecture, and per-provider setup/pricing.

### Fixed
- `token-tank start` no longer crashes with `NameError` — `logging` is now
  imported at module scope.
- Configured `TOKEN_TANK_SECRET_KEY` values (including a `Fernet.generate_key()`
  output) are accepted; the key is derived to a valid 32-byte Fernet key via
  SHA-256 instead of raising `ValueError`.
- `secret_key` binds cleanly to `TOKEN_TANK_SECRET_KEY` (removed a dead default
  that read the wrong env var).
- Streaming proxy responses now reflect the real upstream status and
  content-type, so an upstream 4xx/5xx is no longer masked as a `200` SSE body.
- The proxy `ClientSession` uses an explicit `ClientTimeout` (no total cap for
  long streams, bounded connect time).
- SIGTERM now shuts down **both** the proxy and FastAPI cleanly via a single
  coordinated stop event; previously FastAPI could hang with its port still bound.
- `/health` is registered before the SPA static mount so it is not shadowed in
  production builds.
- `token_tank init` and the config loader agree on the config path and honor
  `TOKEN_TANK_DATA_DIR`.
- `UsageRecordResponse` serializes ORM objects (`from_attributes`).

[0.4.0]: https://github.com/FoxhoundLab/token-tank/releases/tag/v0.4.0
