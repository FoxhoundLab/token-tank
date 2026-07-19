# Token Tank Browser Extension

MV3 extension that captures subscription usage caps from **claude.ai** and **chatgpt.com** and syncs them to your local Token Tank backend.

## Prerequisites

**Token Tank backend must be running on `localhost:8000`** before the extension can sync captured data. If the backend is down, captures are still saved locally in `chrome.storage.local` but won't appear in your dashboard.

```bash
pip install token-tank
token-tank          # starts proxy on 8848 + backend on 8000
```

## Install (load unpacked)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `extension/` directory
5. Pin the Token Tank icon to your toolbar

## What it does

- **Claude.ai content script** (`content-claude.js`):
  - Scans the chat pages for rate-limit messages (legacy heuristic).
  - **Scrapes the real "Plan usage limits" panel** (Settings → Usage) for
    your actual session and weekly percentages — the same numbers
    claude.ai's own UI shows you, since Anthropic doesn't expose them
    through any API. Captures the 5h session window, the weekly "all
    models" cap, and any per-model weekly cap shown there (e.g. Fable).
  - Runs on load, every 60s, and after DOM changes settle (claude.ai is
    a single-page app — the usage panel mounts without a full navigation).
- **ChatGPT content script** (`content-chatgpt.js`): Detects GPT-4 rate limits, active model, upgrade prompts
- **Background service worker** (`background.js`): Receives captured data from content scripts, stores in `chrome.storage.local`, forwards to Token Tank backend
- **Popup** (`popup.html` / `popup.js`): Shows latest captured status for each provider, including the last scraped plan-limits reading and whether it synced

## Getting real numbers into Mission Control

The plan-limits panel only exists on claude.ai's **Settings → Usage**
page — visiting the normal chat page won't capture anything (by design;
an empty scrape is discarded rather than sent, so it never overwrites a
good previous reading with nothing). To refresh your numbers:

1. Sign in to claude.ai with the extension installed.
2. Open **Settings → Usage** (wherever the "Plan usage limits" panel lives).
3. Leave the tab open a few seconds — the scraper captures and syncs
   automatically. Click the extension icon to confirm ("synced ✓").
4. Token Tank's Mission Control picks it up on its next 30s poll.

Revisit that page periodically to keep the numbers fresh — this isn't a
push subscription, since claude.ai doesn't offer one.

## Privacy

- **No content is sent** — only metadata about limits (message count, rate-limit flags, timestamps, plan-usage percentages)
- **No keys, no prompts, no responses** ever leave your browser
- Captured data goes to **localhost:8000** (your Token Tank instance)
- `chrome.storage.local` (not `chrome.storage.sync`) — never leaves your machine

## Backend endpoints

`POST /api/v1/extension/usage` — legacy rate-limit heuristic capture:

```json
{
  "provider": "claude_web" | "chatgpt_web",
  "data": {
    "timestamp": "2026-06-26T12:00:00Z",
    "message_count": 47,
    "rate_limited": true,
    "limit_message": "You've reached your limit..."
  },
  "timestamp": "2026-06-26T12:00:00Z"
}
```

`POST /api/v1/extension/quota` — real plan-usage percentages:

```json
{
  "provider": "claude_web",
  "windows": [
    { "window_type": "5h", "label": "5h Session", "used": 1, "limit": 100, "unit": "percent", "reset_at": "2026-07-19T19:40:59.760Z" },
    { "window_type": "weekly", "label": "Weekly · All models", "used": 2, "limit": 100, "unit": "percent", "reset_at": "2026-07-26T04:00:00.000Z" },
    { "window_type": "model:fable-5", "label": "Fable", "used": 3, "limit": 100, "unit": "percent", "reset_at": "2026-07-26T04:00:00.000Z" }
  ]
}
```

Every POST **replaces** all `source: "extension"` windows for that
provider — a fresh capture supersedes the last one rather than
accumulating. `used`/`limit` are always `1`/`100` with `unit: "percent"`
because that's genuinely all claude.ai's own UI exposes (no raw token
counts) — Token Tank never fabricates a token figure behind a percentage.

If you'd hand-entered placeholder quota windows before installing the
extension (`source: "manual"`), those are automatically superseded once
a real extension reading exists for the same window — Token Tank always
prefers `extension` > `api` > `manual` per window.

## Limitations

- DOM scraping is fragile — UI changes break it. `content-claude.js`
  keys off the panel's *text content* ("X% used", "Resets…", "Weekly
  limits"), not class names, since claude.ai doesn't expose stable ones
  for this panel — but a wording change will still stop extraction.
  If Anthropic renames "Fable" or restyles the panel, edit the
  `MODEL_SLUGS` table or the row-matching regexes at the top of
  `content-claude.js`.
- Only refreshes while you have the Usage settings page open in a tab —
  see "Getting real numbers" above.
- Both claude.ai and chatgpt.com have login walls; scraper only runs when you're signed in
- Background sync requires Token Tank backend running on localhost:8000
- ChatGPT rate-limit capture shows in the browser extension popup, not the dashboard (yet)
