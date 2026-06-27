"""MiniMax provider adapter.

Handles MiniMax API requests routed through /v1/text/chatcompletion_v2
and /v1/chat/completions.  MiniMax uses the OpenAI-compatible response
format (prompt_tokens / completion_tokens in usage object).
"""

from .base import ProviderAdapter, TokenUsage

# Pricing per 1M tokens (input, output are the same for each model).
MINIMAX_PRICING: dict[str, dict[str, float]] = {
    "abab6.5-chat": {"input": 0.7, "output": 0.7},
    "abab5.5-chat": {"input": 0.2, "output": 0.2},
    "abab6.5s-chat": {"input": 0.35, "output": 0.35},
}


class MiniMaxAdapter(ProviderAdapter):
    """Adapter for the MiniMax API."""

    provider_id = "minimax"
    display_name = "MiniMax"
    api_base_url = "https://api.minimax.chat"
    path_prefixes = ["/v1/text/chatcompletion_v2", "/v1/chat/completions"]

    # ------------------------------------------------------------------
    # ProviderAdapter interface
    # ------------------------------------------------------------------

    def matches(self, path: str, headers: dict) -> bool:
        """Return True if the request path matches MiniMax endpoints."""
        return any(path.startswith(p) for p in self.path_prefixes)

    def parse_usage(self, response_body: dict) -> TokenUsage | None:
        """Extract token counts from MiniMax (OpenAI-compatible) response.

        Expected ``usage`` object:
            {"prompt_tokens": 150, "completion_tokens": 80}

        Returns None when no usage data is present.
        """
        usage = response_body.get("usage")
        if not usage:
            return None

        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            model=response_body.get("model", ""),
        )

    def estimate_cost(self, usage: TokenUsage, model: str) -> float:
        """Estimate cost in USD for a MiniMax request."""
        pricing = MINIMAX_PRICING.get(
            model, {"input": 0.7, "output": 0.7}
        )
        cost = (
            usage.input_tokens / 1_000_000 * pricing["input"]
            + usage.output_tokens / 1_000_000 * pricing["output"]
        )
        return round(cost, 6)
