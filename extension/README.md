# Token Tank Browser Extension

MV3 extension that captures subscription usage caps from **Claude Max, Grok, Z.AI, MiniMax and Ollama Pro** and syncs them to your local Token Tank backend.

None of these providers expose plan usage through a public API — the numbers live only in the panels their own web apps render. This reads them off the page while you're signed in.

## Prerequisites

**Token Tank backend must be running on `localhost:8080`** before the extension can sync captured data (port 8000 is the upstream default, but is often taken — see `TOKEN_TANK_BASE` in `background.js` if yours differs). If the backend is down, captures are still saved locally in `chrome.storage.local` but won't appear in your dashboard.

```bash
pip install token-tank
token-tank          # starts proxy on 8848 + backend on 8000 (set TOKEN_TANK_API_PORT to change)
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

Usage panels only exist on each provider's account/usage page — visiting
the normal chat page captures nothing. That's deliberate: an empty scrape
is discarded rather than sent, so it can never overwrite a good previous
reading with nothing.

For each subscription:

1. Sign in with the extension installed.
2. Open that provider's usage page (see the table below).
3. Leave the tab open a few seconds — capture and sync are automatic.
   Click the extension icon to confirm ("synced ✓").
4. Mission Control picks it up on its next 30s poll.

Revisit periodically to keep the numbers fresh — none of these offer a
push subscription, so a reading is only as current as your last visit.

## Privacy

- **No content is sent** — only metadata about limits (message count, rate-limit flags, timestamps, plan-usage percentages)
- **No keys, no prompts, no responses** ever leave your browser
- Captured data goes to **localhost:8080** (your Token Tank instance)
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

## Providers covered

| Provider | Site | Status |
|---|---|---|
| **Claude Max** | claude.ai → Settings → Usage | Purpose-built scraper, verified against the real panel layout |
| **Grok** | grok.com, console.x.ai | Generic engine, config unverified against live DOM |
| **Z.AI GLM** | z.ai, bigmodel.cn | Generic engine, config unverified against live DOM |
| **MiniMax** | minimax.io | Generic engine, config unverified against live DOM |
| **Ollama Pro** | ollama.com | Generic engine, config unverified against live DOM |

The four "unverified" scrapers share `usage-scraper.js`, a text-pattern
engine that recognizes common usage shapes ("42% used", "1,240 / 5,000
requests", "Resets in 3 hr"). The engine itself is unit-tested
(`extension/test/`), but each site's wording could not be confirmed
without a logged-in session. **Open the popup after visiting each usage
page** — it reports per provider whether the scraper ran, what it found,
and whether it synced, so a mismatch is visible immediately instead of
surfacing as a silently stale number. If one reports "Ran, but found no
usage panel", send a screenshot of that page and the config can be
tightened.

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
- Background sync requires the Token Tank backend running (localhost:8080 by default here)
- ChatGPT rate-limit capture shows in the browser extension popup, not the dashboard (yet)
