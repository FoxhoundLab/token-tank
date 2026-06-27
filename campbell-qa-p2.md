You are Colonel Campbell, QA reviewer. Do a thorough QA sweep of Token Tank Phase 2.

PROJECT: Token Tank — multi-provider AI usage monitor with fuel gauge dashboard
REPO: /Users/oshinaka/token-tank/
STACK: Python (FastAPI + aiohttp proxy) + React 18 + Vite + TypeScript

WHAT WAS BUILT (Phase 2, Sprints 2A-2C):
- Sprint 2A: Adapter tests for MiniMax, Ollama, OpenAI (19 new tests)
- Sprint 2B: LM Studio adapter (localhost:1234, $0.00, OpenAI-compatible), wired into registry, 7 tests
- Sprint 2C: Billing API Poller — BillingPoller ABC, AnthropicBillingPoller with admin API, APScheduler background job, 7 tests

VERIFIER STATUS: 72/72 backend tests pass, frontend tsc clean

YOUR JOB: Do a comprehensive QA sweep of the Phase 2 changes. Check for:
1. SECURITY: API key handling in billing poller, no secrets in logs, proper error handling
2. CODE QUALITY: Error handling, edge cases, proper async patterns in billing poller
3. ARCHITECTURE: Does the code match the roadmap? Adapter registry ordering correct?
4. TEST QUALITY: Are tests actually testing meaningful behavior? Coverage gaps?
5. BUGS: Logic errors, race conditions, unhandled cases
6. REGRESSIONS: Did Phase 2 break anything from Phase 1?

Read these files and review them:
- backend/token_tank/proxy/adapters/lmstudio.py (NEW)
- backend/token_tank/proxy/adapters/__init__.py (MODIFIED — registry)
- backend/token_tank/proxy/billing_poller.py (NEW)
- backend/token_tank/main.py (MODIFIED — billing poller startup)
- backend/token_tank/database.py (MODIFIED — WAL mode)
- backend/token_tank/config.py (restored)
- backend/token_tank/crypto.py (restored)
- backend/token_tank/models.py (restored)
- backend/tests/test_adapters.py (MODIFIED — new test classes)
- backend/tests/test_pollers.py (NEW)
- backend/tests/test_api.py (check for regressions)
- backend/tests/test_proxy.py (check for regressions)
- frontend/src/components/Settings.tsx (LM Studio re-added)

Output format: For each file, give a verdict (PASS / WARN / FAIL) with specific findings.
End with an overall verdict and list of must-fix issues (if any).
