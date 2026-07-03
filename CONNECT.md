# Connecting your AI tools to Token Tank

Token Tank is a transparent proxy. Your tools talk to `http://localhost:8848`
instead of the provider's API; Token Tank forwards the request unchanged,
reads the token counts out of the response, and logs them. Your API keys go
to the provider exactly as before — Token Tank never rewrites auth.

## 1. Start the monitor

```bash
pip install token-tank
token-tank init
token-tank start     # proxy on :8848, dashboard on http://localhost:8000
```

Open http://localhost:8000, go to **Settings**, pick your provider, paste a
key (stored Fernet-encrypted, local only), click **Connect**.

## 2. Point your tool at the proxy

The proxy routes by request path, so the base-URL swap is all you need.

| Tool / SDK | Setting |
|---|---|
| Claude Code / Anthropic SDK | `export ANTHROPIC_BASE_URL=http://localhost:8848` |
| OpenAI SDK (python/js) | `export OPENAI_BASE_URL=http://localhost:8848/v1` |
| Z.AI | point the client base URL at `http://localhost:8848/api/paas/v4` |
| MiniMax | base URL `http://localhost:8848/v1` |
| Ollama (cloud) | base URL `http://localhost:8848` (routes `/api/chat`, `/api/generate`, `/api/embeddings`) |
| LM Studio clients | base URL `http://localhost:8848/v1` |

Example — one real call through the proxy:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8848
python -c "
import anthropic
msg = anthropic.Anthropic().messages.create(
    model='claude-sonnet-4', max_tokens=32,
    messages=[{'role': 'user', 'content': 'ping'}])
print(msg.usage)
"
```

## 3. What you should see when it works

- The **LIVE** signal in the dashboard topbar starts pulsing (it lights when
  the proxy logged traffic in the last 60 seconds, and decays after).
- The provider's card updates: tokens today, spend, burn rate.
- The **Event Log** strip at the bottom prints the delta, e.g.
  `ANTHROPIC +1.2K tok`.
- In Settings, the provider cell reads **LIVE** instead of **REGISTERED**.

If nothing moves: confirm the tool actually used the proxy (the base-URL env
var must be set in the shell that runs it), and check `token-tank status`.

## 4. Rate limits and caps

Subscription providers (Anthropic, OpenAI) show quota windows as segmented
rails with reset countdowns. When a window passes 90%, the rail turns warm
and pulses; at 100% it goes red. If a provider starts rejecting requests
upstream (429), the proxy passes the response through unchanged — your tool
sees exactly what the provider sent.

## 5. What the colors mean

| Color | Meaning |
|---|---|
| Cyan (theme accent) | on / healthy / filled |
| Dim cyan | inactive segments, structure |
| Warm amber | approaching a limit (≥90% of a window) |
| Red | blocked / exhausted / link down |

One accent per theme; color changes are state changes, never decoration.
