"""Test fixtures for Token Tank adapter tests.

Real API response samples (sanitized) used to verify parse_usage and estimate_cost.
"""

ANTHROPIC_RESPONSE = {
    "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
    "type": "message",
    "role": "assistant",
    "content": [{"type": "text", "text": "Hello! How can I help you today?"}],
    "model": "claude-sonnet-4-20250514",
    "stop_reason": "end_turn",
    "stop_sequence": None,
    "usage": {
        "input_tokens": 25,
        "output_tokens": 15,
    },
}

ANTHROPIC_STREAMING_CHUNK = {
    "type": "message_delta",
    "usage": {
        "output_tokens": 15,
    },
    "delta": {
        "stop_reason": "end_turn",
    },
}

ZAI_RESPONSE = {
    "id": "chatcmpl-abc123",
    "object": "chat.completion",
    "created": 1719400000,
    "model": "glm-5.2",
    "choices": [
        {
            "index": 0,
            "message": {"role": "assistant", "content": "Hello there!"},
            "finish_reason": "stop",
        }
    ],
    "usage": {
        "prompt_tokens": 30,
        "completion_tokens": 20,
        "total_tokens": 50,
    },
}

OLLAMA_RESPONSE = {
    "model": "llama3",
    "created_at": "2024-01-01T00:00:00Z",
    "message": {"role": "assistant", "content": "Hello!"},
    "done": True,
    "prompt_eval_count": 20,
    "eval_count": 10,
}

MINIMAX_RESPONSE = {
    "id": "abc123",
    "choices": [
        {
            "finish_reason": "stop",
            "index": 0,
            "message": {"content": "Hello!", "role": "assistant"},
        }
    ],
    "model": "MiniMax-M3",
    "object": "chat.completion",
    "usage": {"completion_tokens": 5, "prompt_tokens": 15, "total_tokens": 20},
}

LMSTUDIO_RESPONSE = {
    "id": "chatcmpl-123",
    "object": "chat.completion",
    "created": 1719400000,
    "model": "qwen3.6-35b-a3b-rotorquant-mlx@4bit",
    "choices": [
        {
            "index": 0,
            "message": {"role": "assistant", "content": "Hi!"},
            "finish_reason": "stop",
        }
    ],
    "usage": {
        "prompt_tokens": 12,
        "completion_tokens": 8,
        "total_tokens": 20,
    },
}
