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
# MiniMax and OpenAI both match /v1/chat/completions — MiniMax is listed
# first so that requests with MiniMax-specific headers route correctly.
ADAPTERS: list[ProviderAdapter] = [
    AnthropicAdapter(),
    ZAIAdapter(),
    LMStudioAdapter(),
    MiniMaxAdapter(),
    OpenAIAdapter(),
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
