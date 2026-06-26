"""Z.AI provider adapter."""

from .base import ProviderAdapter, TokenUsage


# Pricing per 1M tokens (as of June 2026, from docs.z.ai)
ZAI_PRICING = {
    "glm-5.2": {"input": 0.6, "output": 2.2},
    "glm-5": {"input": 0.6, "output": 2.2},
    "glm-4-plus": {"input": 2.2, "output": 2.2},
    "glm-4-air": {"input": 0.07, "output": 0.07},
}


class ZAIAdapter(ProviderAdapter):
    provider_id = "zai"
    display_name = "Z.AI"
    api_base_url = "https://api.z.ai"
    path_prefixes = ["/api/paas/v4/chat/completions", "/v4/chat/completions"]

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
        pricing = ZAI_PRICING.get(model, {"input": 0.6, "output": 2.2})
        cost = (
            usage.input_tokens / 1_000_000 * pricing["input"]
            + usage.output_tokens / 1_000_000 * pricing["output"]
        )
        return round(cost, 6)
