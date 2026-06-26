"""Provider adapters registry."""

from .base import ProviderAdapter, TokenUsage
from .anthropic import AnthropicAdapter
from .openai import OpenAIAdapter
from .zai import ZAIAdapter
from .ollama import OllamaAdapter

# Registry of all available adapters
ADAPTERS: list[ProviderAdapter] = [
    AnthropicAdapter(),
    OpenAIAdapter(),
    ZAIAdapter(),
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
]
