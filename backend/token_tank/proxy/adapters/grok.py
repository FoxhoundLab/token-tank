"""Grok (xAI) provider adapter.

The xAI API is OpenAI-compatible and serves /v1/chat/completions — the
same path OpenAI, MiniMax and LM Studio use. Path alone can't identify
it, so this adapter matches on the upstream host (Host / x-tt-upstream
header) or an explicit grok model name in the request. Registered ahead
of OpenAI so a genuine api.x.ai request is attributed correctly.
"""

from .base import ProviderAdapter, TokenUsage


# Pricing per 1M tokens (xAI published rates, July 2026).
GROK_PRICING: dict[str, dict[str, float]] = {
    "grok-4": {"input": 3.0, "output": 15.0},
    "grok-4-heavy": {"input": 3.0, "output": 15.0},
    "grok-3": {"input": 3.0, "output": 15.0},
    "grok-3-mini": {"input": 0.3, "output": 0.5},
    "grok-code-fast-1": {"input": 0.2, "output": 1.5},
}

_HOST_HINTS = ("api.x.ai", "x.ai", "grok.com")


class GrokAdapter(ProviderAdapter):
    """Adapter for the xAI Grok API."""

    provider_id = "grok"
    display_name = "Grok"
    api_base_url = "https://api.x.ai"
    path_prefixes = ["/v1/chat/completions", "/v1/messages"]

    def matches(self, path: str, headers: dict) -> bool:
        """Match only when the request is actually bound for xAI.

        The path is shared with several providers, so an xAI signal in
        the headers is required — otherwise this would hijack every
        OpenAI-compatible request that passes through the proxy.
        """
        if not any(path.startswith(p) for p in self.path_prefixes):
            return False

        # Header lookups are case-insensitive in practice; normalize.
        lowered = {str(k).lower(): str(v).lower() for k, v in (headers or {}).items()}
        for key in ("x-tt-upstream", "host", "x-forwarded-host"):
            value = lowered.get(key, "")
            if any(hint in value for hint in _HOST_HINTS):
                return True

        # An explicit grok model in a passthrough header also identifies it.
        return "grok" in lowered.get("x-tt-model", "")

    def parse_usage(self, response_body: dict) -> TokenUsage | None:
        """Extract token counts from an xAI (OpenAI-compatible) response."""
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
        """Estimate cost in USD for a Grok request."""
        pricing = GROK_PRICING.get(model, {"input": 3.0, "output": 15.0})
        cost = (
            usage.input_tokens / 1_000_000 * pricing["input"]
            + usage.output_tokens / 1_000_000 * pricing["output"]
        )
        return round(cost, 6)
