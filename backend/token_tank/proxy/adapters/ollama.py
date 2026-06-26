"""Ollama provider adapter (Ollama Cloud / Pro)."""

from .base import ProviderAdapter, TokenUsage


# Ollama uses GPU-time-based pricing (model tiers L1-L4)
# These are approximate conversions for cost estimation
OLLAMA_PRICING = {
    # Per 1M tokens, approximate
    "llama3.3:70b": {"input": 0.6, "output": 0.6},
    "qwen2.5:32b": {"input": 0.2, "output": 0.2},
    "deepseek-r1": {"input": 0.8, "output": 0.8},
}


class OllamaAdapter(ProviderAdapter):
    provider_id = "ollama"
    display_name = "Ollama"
    api_base_url = "https://ollama.com"
    path_prefixes = ["/api/chat", "/api/generate", "/api/embeddings"]

    def matches(self, path: str, headers: dict) -> bool:
        return any(path.startswith(p) for p in self.path_prefixes)

    def parse_usage(self, response_body: dict) -> TokenUsage | None:
        # Ollama returns different field names than OpenAI
        input_tokens = response_body.get("prompt_eval_count", 0)
        output_tokens = response_body.get("eval_count", 0)
        if input_tokens == 0 and output_tokens == 0:
            return None
        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            model=response_body.get("model", ""),
        )

    def estimate_cost(self, usage: TokenUsage, model: str) -> float:
        pricing = OLLAMA_PRICING.get(model, {"input": 0.6, "output": 0.6})
        cost = (
            usage.input_tokens / 1_000_000 * pricing["input"]
            + usage.output_tokens / 1_000_000 * pricing["output"]
        )
        return round(cost, 6)
