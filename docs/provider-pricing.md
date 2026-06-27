# Provider Pricing Reference

**Last updated:** 2026-06-26

Pricing per 1M tokens (input, output). Token Tank uses these tables to estimate cost per request.

---

## Anthropic

| Model | Input $/1M | Output $/1M |
|---|---|---|
| Claude Opus 4 | $15.00 | $75.00 |
| Claude Sonnet 4 | $3.00 | $15.00 |
| Claude Haiku 3.5 | $0.80 | $4.00 |

**Source:** https://www.anthropic.com/pricing

---

## Z.AI

| Model | Input $/1M | Output $/1M |
|---|---|---|
| GLM-5.2 | $0.60 | $2.20 |
| GLM-5 | $0.60 | $2.20 |
| GLM-4-Plus | $2.20 | $2.20 |
| GLM-4-Air | $0.07 | $0.07 |

**Source:** https://docs.z.ai/guides/overview/quick-start/using-the-api

---

## MiniMax

| Model | Input $/1M | Output $/1M |
|---|---|---|
| abab6.5-chat | $0.70 | $0.70 |
| abab5.5-chat | $0.20 | $0.20 |
| abab6.5s-chat | $0.35 | $0.35 |

**Source:** https://minimax.io/pricing

---

## OpenAI

| Model | Input $/1M | Output $/1M |
|---|---|---|
| GPT-4o | $2.50 | $10.00 |
| GPT-4o-mini | $0.15 | $0.60 |
| GPT-4-turbo | $10.00 | $30.00 |
| o1 | $15.00 | $60.00 |
| o3 | $10.00 | $40.00 |

**Source:** https://openai.com/api/pricing

---

## Ollama Pro

GPU-time-based pricing (approximate):

| Model | Input $/1M | Output $/1M |
|---|---|---|
| Llama 3.3 70B | $0.60 | $0.60 |
| Qwen 2.5 32B | $0.20 | $0.20 |
| DeepSeek R1 | $0.80 | $0.80 |

**Source:** https://ollama.com/pricing

---

## LM Studio (Local)

| Model | Input $/1M | Output $/1M |
|---|---|---|
| Any model | $0.00 | $0.00 |

**Source:** Free — runs entirely on your hardware. No API costs.

---

## Notes

- Pricing tables are loaded from `backend/token_tank/proxy/adapters/*.py` pricing dicts
- Unknown models fall back to the first listed model's pricing
- Anthropic billing data (when available via org admin API) supersedes these estimates
- Pricing is per 1,000,000 tokens. Multiply your token count by (price/1M) to estimate cost.

**Update this file when providers change pricing.**
