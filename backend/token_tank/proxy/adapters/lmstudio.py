"""LM Studio provider adapter (local OpenAI-compatible server).

LM Studio runs models entirely on the user's machine and exposes an
OpenAI-compatible HTTP API (default port 1234). There is no pricing —
everything runs locally and costs $0.00.
"""

from .base import ProviderAdapter, TokenUsage


class LMStudioAdapter(ProviderAdapter):
    provider_id = "lmstudio"
    display_name = "LM Studio"
    api_base_url = "http://localhost:1234"
    path_prefixes = ["/v1/chat/completions", "/v1/completions"]

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
        # LM Studio runs locally -- always free.
        return 0.0
