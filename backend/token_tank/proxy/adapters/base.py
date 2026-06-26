"""Provider adapter base class."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class TokenUsage:
    """Parsed token usage from an API response."""

    input_tokens: int
    output_tokens: int
    total_tokens: int
    model: str = ""

    @property
    def cost(self) -> float:
        """Override in subclass with pricing logic."""
        return 0.0


class ProviderAdapter(ABC):
    """Base class for provider adapters.

    Each adapter knows how to:
    1. Identify requests destined for its provider
    2. Parse token counts from API responses
    3. Estimate cost based on provider pricing
    """

    # Identity
    provider_id: str = ""
    display_name: str = ""

    # Proxy routing
    api_base_url: str = ""
    path_prefixes: list[str] = []

    @abstractmethod
    def matches(self, path: str, headers: dict) -> bool:
        """Return True if this request belongs to this provider."""
        ...

    @abstractmethod
    def parse_usage(self, response_body: dict) -> TokenUsage | None:
        """Extract token counts from the API response body.

        Returns None if usage data is not present in the response.
        """
        ...

    @abstractmethod
    def estimate_cost(self, usage: TokenUsage, model: str) -> float:
        """Estimate cost in USD based on provider pricing."""
        ...
