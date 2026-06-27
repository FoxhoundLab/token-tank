# Token Tank Browser Extension

MV3 extension that captures subscription usage caps from **claude.ai** and **chatgpt.com** and syncs them to your local Token Tank backend.

## Install (load unpacked)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `extension/` directory
5. Pin the Token Tank icon to your toolbar

## What it does

- **Claude.ai content script** (`content-claude.js`): Scans the page for rate-limit messages, message counts, quota indicators
- **ChatGPT content script** (`content-chatgpt.js`): Detects GPT-4 rate limits, active model, upgrade prompts
- **Background service worker** (`background.js`): Receives captured data from content scripts, stores in `chrome.storage.local`, forwards to Token Tank backend
- **Popup** (`popup.html` / `popup.js`): Shows latest captured status for each provider

## Privacy

- **No content is sent** — only metadata about limits (message count, rate-limit flags, timestamps)
- **No keys, no prompts, no responses** ever leave your browser
- Captured data goes to **localhost:8000** (your Token Tank instance)
- `chrome.storage.local` (not `chrome.storage.sync`) — never leaves your machine

## Backend endpoint

POST `/api/v1/extension/usage`

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

## Limitations

- DOM scraping is fragile — UI changes break it
- Both claude.ai and chatgpt.com have login walls; scraper only runs when you're signed in
- Background sync requires Token Tank backend running on localhost:8000
- Captured data shows in the browser extension popup, not the dashboard (yet)
