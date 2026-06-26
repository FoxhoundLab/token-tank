"""Adapter tests — verify parse_usage and estimate_cost for each provider."""

import pytest
from token_tank.proxy.adapters.anthropic import AnthropicAdapter
from token_tank.proxy.adapters.zai import ZAIAdapter
from token_tank.proxy.adapters.base import TokenUsage

from tests.fixtures.responses import (
    ANTHROPIC_RESPONSE,
    ZAI_RESPONSE,
    OLLAMA_RESPONSE,
    MINIMAX_RESPONSE,
    LMSTUDIO_RESPONSE,
)


class TestAnthropicAdapter:
    def setup_method(self):
        self.adapter = AnthropicAdapter()

    def test_matches_messages_endpoint(self):
        assert self.adapter.matches("/v1/messages", {})
        assert self.adapter.matches("/v1/messages/batch", {})

    def test_does_not_match_other_paths(self):
        assert not self.adapter.matches("/v1/chat/completions", {})
        assert not self.adapter.matches("/api/chat", {})

    def test_parse_usage(self):
        usage = self.adapter.parse_usage(ANTHROPIC_RESPONSE)
        assert usage is not None
        assert usage.input_tokens == 25
        assert usage.output_tokens == 15
        assert usage.total_tokens == 40
        assert usage.model == "claude-sonnet-4-20250514"

    def test_parse_usage_missing(self):
        assert self.adapter.parse_usage({}) is None
        assert self.adapter.parse_usage({"usage": {}}) is None

    def test_estimate_cost(self):
        usage = TokenUsage(
            input_tokens=1_000_000,
            output_tokens=500_000,
            total_tokens=1_500_000,
            model="claude-sonnet-4",
        )
        cost = self.adapter.estimate_cost(usage, "claude-sonnet-4")
        # 1M input @ $3 + 500K output @ $15 = 3 + 7.5 = 10.5
        assert cost == pytest.approx(10.5, rel=0.01)

    def test_estimate_cost_unknown_model(self):
        usage = TokenUsage(
            input_tokens=1000,
            output_tokens=500,
            total_tokens=1500,
            model="unknown-model",
        )
        cost = self.adapter.estimate_cost(usage, "unknown-model")
        assert cost > 0  # Falls back to default pricing


class TestZAIAdapter:
    def setup_method(self):
        self.adapter = ZAIAdapter()

    def test_matches_chat_completions(self):
        assert self.adapter.matches("/api/paas/v4/chat/completions", {})
        assert self.adapter.matches("/v4/chat/completions", {})

    def test_does_not_match_anthropic(self):
        assert not self.adapter.matches("/v1/messages", {})

    def test_parse_usage(self):
        usage = self.adapter.parse_usage(ZAI_RESPONSE)
        assert usage is not None
        assert usage.input_tokens == 30
        assert usage.output_tokens == 20
        assert usage.total_tokens == 50
        assert usage.model == "glm-5.2"

    def test_parse_usage_missing(self):
        assert self.adapter.parse_usage({}) is None

    def test_estimate_cost(self):
        usage = TokenUsage(
            input_tokens=1_000_000,
            output_tokens=500_000,
            total_tokens=1_500_000,
            model="glm-5.2",
        )
        cost = self.adapter.estimate_cost(usage, "glm-5.2")
        # 1M input @ $0.6 + 500K output @ $2.2 = 0.6 + 1.1 = 1.7
        assert cost == pytest.approx(1.7, rel=0.01)


class TestAdapterRegistry:
    def test_get_adapter_finds_anthropic(self):
        from token_tank.proxy.adapters import get_adapter
        adapter = get_adapter("/v1/messages", {})
        assert adapter is not None
        assert adapter.provider_id == "anthropic"

    def test_get_adapter_finds_zai(self):
        from token_tank.proxy.adapters import get_adapter
        adapter = get_adapter("/api/paas/v4/chat/completions", {})
        assert adapter is not None
        assert adapter.provider_id == "zai"

    def test_get_adapter_returns_none_for_unknown(self):
        from token_tank.proxy.adapters import get_adapter
        assert get_adapter("/unknown/path", {}) is None
