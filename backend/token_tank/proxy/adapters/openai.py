"""OpenAI provider adapter."""

from .base import ProviderAdapter, TokenUsage


# Pricing per 1M tokens (as of June 2026)
OPENAI_PRICING = {
    "gpt-4o": {"input": 2.5, "output": 10.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6},
    "gpt-4-turbo": {"input": 10.0, "output": 30.0},
    "o1": {"input": 15.0, "output": 60.0},
    "o3": {"input": 10.0, "output": 40.0},
}


class OpenAIAdapter(ProviderAdapter):
    provider_id = "openai"
    display_name = "OpenAI"
    api_base_url = "https://api.openai.com"
    path_prefixes = ["/v1/chat/completions", "/v1/completions", "/v1/responses"]

    def matches(self, path: str, headers: dict) -> bool:
        return any(path.startswith(p) for p in self.path_prefixes)

    def parse_usage(self, response_body: dict) -> TokenUsage | None:
        usage = response_body.get("usage")
        if not usage:
            return None
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=usage.get("total_tokens", input_tokens + output_tokens),
            model=response_body.get("model", ""),
        )

    def estimate_cost(self, usage: TokenUsage, model: str) -> float:
        pricing = OPENAI_PRICING.get(model, {"input": 2.5, "output": 10.0})
        cost = (
            usage.input_tokens / 1_000_000 * pricing["input"]
            + usage.output_tokens / 1_000_000 * pricing["output"]
        )
        return round(cost, 6)
