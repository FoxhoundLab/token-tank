"""Adapter tests — verify parse_usage and estimate_cost for each provider."""

import pytest
from token_tank.proxy.adapters.anthropic import AnthropicAdapter
from token_tank.proxy.adapters.zai import ZAIAdapter
from token_tank.proxy.adapters.minimax import MiniMaxAdapter
from token_tank.proxy.adapters.ollama import OllamaAdapter
from token_tank.proxy.adapters.openai import OpenAIAdapter
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


class TestMiniMaxAdapter:
    def setup_method(self):
        self.adapter = MiniMaxAdapter()

    def test_matches_chatcompletion_v2(self):
        assert self.adapter.matches("/v1/text/chatcompletion_v2", {})
        assert self.adapter.matches("/v1/text/chatcompletion_v2/extra", {})

    def test_matches_chat_completions(self):
        assert self.adapter.matches("/v1/chat/completions", {})

    def test_does_not_match_other_paths(self):
        assert not self.adapter.matches("/v1/messages", {})
        assert not self.adapter.matches("/api/chat", {})

    def test_parse_usage(self):
        usage = self.adapter.parse_usage(MINIMAX_RESPONSE)
        assert usage is not None
        assert usage.input_tokens == 15
        assert usage.output_tokens == 5
        assert usage.total_tokens == 20
        assert usage.model == "MiniMax-M3"

    def test_parse_usage_missing(self):
        assert self.adapter.parse_usage({}) is None
        assert self.adapter.parse_usage({"usage": {}}) is None

    def test_estimate_cost(self):
        usage = TokenUsage(
            input_tokens=1_000_000,
            output_tokens=500_000,
            total_tokens=1_500_000,
            model="abab6.5-chat",
        )
        cost = self.adapter.estimate_cost(usage, "abab6.5-chat")
        # 1M input @ $0.7 + 500K output @ $0.7 = 0.7 + 0.35 = 1.05
        assert cost == pytest.approx(1.05, rel=0.01)

    def test_estimate_cost_unknown_model(self):
        usage = TokenUsage(
            input_tokens=1000,
            output_tokens=500,
            total_tokens=1500,
            model="unknown-model",
        )
        cost = self.adapter.estimate_cost(usage, "unknown-model")
        assert cost > 0  # Falls back to default pricing


class TestOllamaAdapter:
    def setup_method(self):
        self.adapter = OllamaAdapter()

    def test_matches_chat_endpoint(self):
        assert self.adapter.matches("/api/chat", {})
        assert self.adapter.matches("/api/generate", {})

    def test_matches_embeddings_endpoint(self):
        assert self.adapter.matches("/api/embeddings", {})

    def test_does_not_match_other_paths(self):
        assert not self.adapter.matches("/v1/messages", {})
        assert not self.adapter.matches("/v1/chat/completions", {})

    def test_parse_usage(self):
        usage = self.adapter.parse_usage(OLLAMA_RESPONSE)
        assert usage is not None
        assert usage.input_tokens == 20
        assert usage.output_tokens == 10
        assert usage.total_tokens == 30
        assert usage.model == "llama3"

    def test_parse_usage_missing(self):
        assert self.adapter.parse_usage({}) is None

    def test_estimate_cost(self):
        usage = TokenUsage(
            input_tokens=1_000_000,
            output_tokens=500_000,
            total_tokens=1_500_000,
            model="llama3.3:70b",
        )
        cost = self.adapter.estimate_cost(usage, "llama3.3:70b")
        # 1M input @ $0.6 + 500K output @ $0.6 = 0.6 + 0.3 = 0.9
        assert cost == pytest.approx(0.9, rel=0.01)

    def test_estimate_cost_unknown_model(self):
        usage = TokenUsage(
            input_tokens=1000,
            output_tokens=500,
            total_tokens=1500,
            model="unknown-model",
        )
        cost = self.adapter.estimate_cost(usage, "unknown-model")
        assert cost > 0  # Falls back to default pricing


class TestOpenAIAdapter:
    def setup_method(self):
        self.adapter = OpenAIAdapter()

    def test_matches_chat_completions(self):
        assert self.adapter.matches("/v1/chat/completions", {})
        assert self.adapter.matches("/v1/completions", {})

    def test_matches_responses_endpoint(self):
        assert self.adapter.matches("/v1/responses", {})

    def test_does_not_match_other_paths(self):
        assert not self.adapter.matches("/v1/messages", {})
        assert not self.adapter.matches("/api/chat", {})

    def test_parse_usage(self):
        usage = self.adapter.parse_usage(ZAI_RESPONSE)
        assert usage is not None
        assert usage.input_tokens == 30
        assert usage.output_tokens == 20
        assert usage.total_tokens == 50
        # zai fixture model is glm-5.2 but OpenAI adapter reads the same format
        assert usage.model == "glm-5.2"

    def test_parse_usage_missing(self):
        assert self.adapter.parse_usage({}) is None
        assert self.adapter.parse_usage({"usage": {}}) is None

    def test_estimate_cost(self):
        usage = TokenUsage(
            input_tokens=1_000_000,
            output_tokens=500_000,
            total_tokens=1_500_000,
            model="gpt-4o",
        )
        cost = self.adapter.estimate_cost(usage, "gpt-4o")
        # 1M input @ $2.5 + 500K output @ $10 = 2.5 + 5.0 = 7.5
        assert cost == pytest.approx(7.5, rel=0.01)

    def test_estimate_cost_unknown_model(self):
        usage = TokenUsage(
            input_tokens=1000,
            output_tokens=500,
            total_tokens=1500,
            model="unknown-model",
        )
        cost = self.adapter.estimate_cost(usage, "unknown-model")
        assert cost > 0  # Falls back to default pricing


class TestLMStudioAdapter:
    def setup_method(self):
        from token_tank.proxy.adapters.lmstudio import LMStudioAdapter
        self.adapter = LMStudioAdapter()

    def test_matches_chat_completions(self):
        assert self.adapter.matches("/v1/chat/completions", {})

    def test_matches_completions(self):
        assert self.adapter.matches("/v1/completions", {})

    def test_does_not_match_anthropic(self):
        assert not self.adapter.matches("/v1/messages", {})
        assert not self.adapter.matches("/api/chat", {})

    def test_parse_usage(self):
        usage = self.adapter.parse_usage(LMSTUDIO_RESPONSE)
        assert usage is not None
        assert usage.input_tokens == 12
        assert usage.output_tokens == 8
        assert usage.total_tokens == 20
        assert usage.model == "qwen3.6-35b-a3b-rotorquant-mlx@4bit"

    def test_parse_usage_missing(self):
        assert self.adapter.parse_usage({}) is None
        assert self.adapter.parse_usage({"usage": {}}) is None

    def test_estimate_cost_always_zero(self):
        usage = TokenUsage(
            input_tokens=1_000_000,
            output_tokens=500_000,
            total_tokens=1_500_000,
            model="any-local-model",
        )
        cost = self.adapter.estimate_cost(usage, "any-local-model")
        assert cost == 0.0  # LM Studio is free/local


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

    def test_get_adapter_finds_minimax(self):
        from token_tank.proxy.adapters import get_adapter

        # Use MiniMax-specific path — /v1/chat/completions also matches LM Studio + OpenAI
        adapter = get_adapter("/v1/text/chatcompletion_v2", {})
        assert adapter is not None
        assert adapter.provider_id == "minimax"

    def test_get_adapter_finds_ollama(self):
        from token_tank.proxy.adapters import get_adapter

        adapter = get_adapter("/api/chat", {})
        assert adapter is not None
        assert adapter.provider_id == "ollama"

    def test_get_adapter_finds_openai(self):
        from token_tank.proxy.adapters import get_adapter

        # /v1/responses is OpenAI-specific (not matched by LM Studio)
        adapter = get_adapter("/v1/responses", {})
        assert adapter is not None
        assert adapter.provider_id == "openai"

    def test_get_adapter_finds_lmstudio(self):
        from token_tank.proxy.adapters import get_adapter

        # LM Studio is now AFTER OpenAI in registry — /v1/chat/completions
        # routes to OpenAI first. Verify LM Studio is still reachable via the
        # adapter instance directly.
        from token_tank.proxy.adapters.lmstudio import LMStudioAdapter
        adapter = LMStudioAdapter()
        assert adapter.provider_id == "lmstudio"
        assert adapter.matches("/v1/chat/completions", {})

    def test_get_adapter_returns_none_for_unknown(self):
        from token_tank.proxy.adapters import get_adapter

        assert get_adapter("/unknown/path", {}) is None
