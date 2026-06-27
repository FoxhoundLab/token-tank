# Provider Setup Guide

How to connect each provider to Token Tank.

---

## Anthropic (Claude)

1. **Get API key**: https://console.anthropic.com/settings/keys → "Create Key"
2. **Connect**:
   - Open Token Tank dashboard → Settings → Click "Anthropic"
   - Paste API key → Click "Connect"
3. **Point tools at proxy**:
   ```bash
   export ANTHROPIC_API_BASE=http://localhost:8848
   export ANTHROPIC_API_KEY=sk-ant-...
   ```
4. **Verify**: Send a test message. Check the dashboard — fuel gauge should move.

**Supported models**: Claude Sonnet 4, Opus 4, Haiku 3.5

---

## Z.AI (GLM)

1. **Get API key**: https://z.ai → Account → API Keys
2. **Connect**:
   - Open Token Tank dashboard → Settings → Click "Z.AI"
   - Paste API key → Click "Connect"
3. **Point tools at proxy**:
   ```bash
   export ZAI_API_BASE=http://localhost:8848/api/paas/v4
   export ZAI_API_KEY=...
   ```
4. **Verify**: Send a test message. GLM 5.2 / GLM-4 models.

**Supported models**: glm-5.2, glm-5, glm-4-plus, glm-4-air

---

## MiniMax

1. **Get API key**: https://minimax.io → Console → API Keys
2. **Connect**:
   - Open Token Tank dashboard → Settings → Click "MiniMax"
   - Paste API key → Click "Connect"
3. **Point tools at proxy**:
   ```bash
   export MINIMAX_API_BASE=http://localhost:8848
   export MINIMAX_API_KEY=...
   ```
4. **Verify**: Send a test message. MiniMax-M3 model.

**Supported models**: abab6.5-chat, abab5.5-chat, abab6.5s-chat

---

## OpenAI

1. **Get API key**: https://platform.openai.com/api-keys
2. **Connect**:
   - Open Token Tank dashboard → Settings → Click "OpenAI"
   - Paste API key → Click "Connect"
3. **Point tools at proxy**:
   ```bash
   export OPENAI_API_BASE=http://localhost:8848/v1
   export OPENAI_API_KEY=sk-...
   ```
4. **Verify**: Send a test message. GPT-4o, o1, o3 models.

**Supported models**: gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o3

---

## Ollama Pro

1. **Sign up**: https://ollama.com → Account → Pro plan
2. **Get API key**: Account Settings → API Keys
3. **Connect**:
   - Open Token Tank dashboard → Settings → Click "Ollama Pro"
   - Paste API key → Click "Connect"
4. **Point tools at proxy**:
   ```bash
   export OLLAMA_HOST=https://ollama.com
   export OLLAMA_API_KEY=...
   ```
5. **Verify**: Send a test message. Llama, Qwen, DeepSeek models.

**Supported models**: llama3.3:70b, qwen2.5:32b, deepseek-r1

---

## LM Studio (Local)

1. **Download**: https://lmstudio.ai
2. **Start server**: Developer tab → "Start Server" (default: localhost:1234)
3. **Connect**:
   - Open Token Tank dashboard → Settings → Click "LM Studio"
   - No API key needed — local server
4. **Auto-detect**: Token Tank probes localhost:1234 on startup. If running, the card appears in your dashboard.
5. **Point tools at proxy**:
   ```bash
   export LMSTUDIO_API_BASE=http://localhost:8848/v1
   # No API key — local
   ```
6. **Verify**: Send a test message. Costs are always $0.00.

**Supported models**: Any model loaded in LM Studio (Qwen, Gemma, Llama, etc.)

---

## Tool-Specific Setup

### Claude Code (Anthropic CLI)
```bash
export ANTHROPIC_API_BASE=http://localhost:8848
export ANTHROPIC_API_KEY=sk-ant-api-...your-key
claude
```

### Hermes (agent)
Add to `~/.hermes/config.yaml`:
```yaml
providers:
  - id: anthropic
    base_url: http://localhost:8848
```

### OpenAI Python SDK
```python
import openai
client = openai.OpenAI(
    base_url="http://localhost:8848/v1",
    api_key="sk-...",
)
```

### curl (any tool)
```bash
curl http://localhost:8848/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "hello"}]}'
```
