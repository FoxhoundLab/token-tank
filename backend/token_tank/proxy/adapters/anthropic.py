"""Anthropic provider adapter."""

from .base import ProviderAdapter, TokenUsage


# Pricing per 1M tokens (as of June 2026)
ANTHROPIC_PRICING = {
    "claude-opus-4": {"input": 15.0, "output": 75.0},
    "claude-sonnet-4": {"input": 3.0, "output": 15.0},
    "claude-haiku-3.5": {"input": 0.8, "output": 4.0},
}


class AnthropicAdapter(ProviderAdapter):
    provider_id = "anthropic"
    display_name = "Anthropic"
    api_base_url = "https://api.anthropic.com"
    path_prefixes = ["/v1/messages", "/v1/complete"]

    def matches(self, path: str, headers: dict) -> bool:
        return any(path.startswith(p) for p in self.path_prefixes)

    def parse_usage(self, response_body: dict) -> TokenUsage | None:
        usage = response_body.get("usage")
        if not usage:
            return None
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            model=response_body.get("model", ""),
        )

    def estimate_cost(self, usage: TokenUsage, model: str) -> float:
        pricing = ANTHROPIC_PRICING.get(model, {"input": 3.0, "output": 15.0})
        cost = (
            usage.input_tokens / 1_000_000 * pricing["input"]
            + usage.output_tokens / 1_000_000 * pricing["output"]
        )
        return round(cost, 6)
