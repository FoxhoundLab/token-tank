You are Colonel Campbell, QA reviewer. Do a thorough QA sweep of Token Tank Phases 4-5.

PROJECT: Token Tank — multi-provider AI usage monitor with fuel gauge dashboard
REPO: /Users/oshinaka/token-tank/
STACK: Python (FastAPI + aiohttp proxy) + React 18 + Vite + TypeScript + Chrome MV3 extension

WHAT WAS BUILT (Phases 4-5):
- Sprint 4A: Single-command launcher (python -m token_tank), CLI subcommands (start/stop/status/init), frontend production build served from FastAPI when dist/ exists, TOML config file at ~/.token-tank/config.toml, first-run wizard, LM Studio auto-detect
- Sprint 4B: pyproject.toml ready for pip install token-tank, .env.example with Fernet key gen
- Sprint 4C: README + CONTRIBUTING.md + docs/provider-setup.md + docs/provider-pricing.md + docs/architecture.md
- Sprint 5A: Browser extension scaffold (MV3) — content scripts for claude.ai + chatgpt.com DOM scraping, background worker, popup UI, backend POST /api/v1/extension/usage endpoint

VERIFIER STATUS: 115/115 backend tests pass, frontend tsc clean, frontend production build succeeds (152KB JS)

YOUR JOB: Comprehensive QA sweep of the new code. Check for:
1. SECURITY: API key handling in CLI/wizard, .env.example secrets, extension permissions, extension-to-backend auth, TOML config injection
2. CODE QUALITY: Error handling in __main__.py, graceful shutdown, CLI argument validation, wizard probes don't crash on missing deps
3. ARCHITECTURE: Single-command launcher actually runs both processes correctly? Config file precedence (TOML vs env vs defaults)? Extension endpoint auth model?
4. TEST QUALITY: Are the new tests actually testing meaningful behavior? test_config_wizard.py — do the mocks actually exercise the code paths?
5. BUGS: Logic errors in CLI, TOML parsing edge cases, extension scraper race conditions, missing dependencies (tomli_w etc)
6. REGRESSIONS: Did Phase 4-5 break anything from Phase 1-3?
7. PRODUCTION READINESS: Would pip install token-tank && token-tank actually work on a clean macOS install?

Read these files and review them:
- backend/token_tank/__main__.py (NEW)
- backend/token_tank/cli.py (NEW)
- backend/token_tank/wizard.py (NEW)
- backend/token_tank/config.py (MODIFIED — TOML support added)
- backend/token_tank/main.py (MODIFIED — extension router added)
- backend/token_tank/routers/extension.py (NEW)
- backend/tests/test_config_wizard.py (NEW)
- backend/tests/test_extension.py (NEW)
- pyproject.toml (NEW)
- .env.example (NEW)
- extension/manifest.json (NEW)
- extension/content-claude.js (NEW)
- extension/content-chatgpt.js (NEW)
- extension/background.js (NEW)
- extension/popup.html (NEW)
- extension/popup.js (NEW)
- extension/README.md (NEW)
- docs/architecture.md (NEW)
- docs/provider-setup.md (NEW)
- docs/provider-pricing.md (NEW)
- CONTRIBUTING.md (NEW)
- README.md (UPDATED)

Output format: For each file, give a verdict (PASS / WARN / FAIL) with specific findings.
End with an overall verdict and list of must-fix issues (if any).
