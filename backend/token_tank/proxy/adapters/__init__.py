"""Provider adapters registry."""

from .base import ProviderAdapter, TokenUsage
from .anthropic import AnthropicAdapter
from .openai import OpenAIAdapter
from .zai import ZAIAdapter
from .ollama import OllamaAdapter
from .minimax import MiniMaxAdapter
from .lmstudio import LMStudioAdapter

# Registry of all available adapters
# Order matters: more specific matchers first.
# - Anthropic: unique /v1/messages path — always first
# - ZAI: unique /api/paas/v4 path
# - MiniMax: has /v1/text/chatcompletion_v2 (unique) + /v1/chat/completions (shared)
# - OpenAI: /v1/chat/completions + /v1/responses (unique) + /v1/completions
# - LM Studio: /v1/chat/completions + /v1/completions — SUBSET of OpenAI
#   Put LM Studio LAST so OpenAI wins for shared paths when both are active.
#   When LM Studio is the intended target, the request comes from localhost
#   and OpenAI API key auth will fail upstream, naturally routing back.
ADAPTERS: list[ProviderAdapter] = [
    AnthropicAdapter(),
    ZAIAdapter(),
    MiniMaxAdapter(),
    OpenAIAdapter(),
    LMStudioAdapter(),
    OllamaAdapter(),
]


def get_adapter(path: str, headers: dict) -> ProviderAdapter | None:
    """Find the adapter that matches the given request."""
    for adapter in ADAPTERS:
        if adapter.matches(path, headers):
            return adapter
    return None


__all__ = [
    "ProviderAdapter",
    "TokenUsage",
    "ADAPTERS",
    "get_adapter",
    "AnthropicAdapter",
    "OpenAIAdapter",
    "ZAIAdapter",
    "OllamaAdapter",
    "MiniMaxAdapter",
    "LMStudioAdapter",
]
