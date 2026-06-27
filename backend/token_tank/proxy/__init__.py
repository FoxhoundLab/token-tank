"""Token Tank proxy — no sub-packages yet (Sprint 1A placeholder).

The full proxy implementation will include:
  - server.py    — aiohttp HTTP proxy on port 8848
  - router.py    — provider detection from request path/headers
  - adapters/    — per-provider token parsers

The billing poller lives below:
  - billing_poller.py  — BillingPoller ABC + AnthropicBillingPoller (Sprint 2C)
"""
