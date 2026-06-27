# Contributing to Token Tank

Thanks for adding a new provider adapter! The process is straightforward.

---

## Adding a New Provider Adapter

### 1. Copy the template

```bash
cp backend/token_tank/proxy/adapters/anthropic.py \
   backend/token_tank/proxy/adapters/myprovider.py
```

Open `myprovider.py` and update:

```python
class MyProviderAdapter(ProviderAdapter):
    provider_id = "myprovider"          # Internal identifier
    display_name = "My Provider"        # Human-readable name
    api_base_url = "https://api.myprovider.com"
    path_prefixes = ["/v1/chat/completions"]   # API path prefix(es)

    def matches(self, path: str, headers: dict) -> bool:
        return any(path.startswith(p) for p in self.path_prefixes)

    def parse_usage(self, response_body: dict) -> TokenUsage | None:
        usage = response_body.get("usage", {})
        return TokenUsage(
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            model=response_body.get("model", ""),
        )

    def estimate_cost(self, usage: TokenUsage, model: str) -> float:
        pricing = MY_PROVIDER_PRICING.get(model, {"input": 1.0, "output": 3.0})
        return (
            usage.input_tokens / 1_000_000 * pricing["input"]
            + usage.output_tokens / 1_000_000 * pricing["output"]
        )
```

### 2. Add to the registry

Edit `backend/token_tank/proxy/adapters/__init__.py`:

```python
from .myprovider import MyProviderAdapter

ADAPTERS: list[ProviderAdapter] = [
    AnthropicAdapter(),
    MyProviderAdapter(),  # Add here — before OpenAI for path collisions
    ...
]
```

### 3. Add a test fixture

Edit `backend/tests/fixtures/responses.py`:

```python
MY_PROVIDER_RESPONSE = {
    "id": "chatcmpl-xyz",
    "model": "my-model",
    "choices": [...],
    "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
}
```

### 4. Write adapter tests

Add to `backend/tests/test_adapters.py`:

```python
class TestMyProviderAdapter:
    def setup_method(self):
        self.adapter = MyProviderAdapter()

    def test_matches(self):
        assert self.adapter.matches("/v1/chat/completions", {})
        assert not self.adapter.matches("/unknown", {})

    def test_parse_usage(self):
        usage = self.adapter.parse_usage(MY_PROVIDER_RESPONSE)
        assert usage.input_tokens == 100
        assert usage.output_tokens == 50
        assert usage.total_tokens == 150

    def test_estimate_cost(self):
        usage = TokenUsage(input_tokens=1_000_000, output_tokens=500_000, total_tokens=1_500_000, model="my-model")
        cost = self.adapter.estimate_cost(usage, "my-model")
        assert cost > 0
```

### 5. Add to Settings picker

Edit `frontend/src/components/Settings.tsx`:

```typescript
const PROVIDER_OPTIONS = [
  ...
  { id: "myprovider", name: "My Provider", icon: "🚀", needsKey: true },
];
```

### 6. Run the verifier

```bash
cd backend && .venv/bin/pytest tests/test_adapters.py -q
cd ../frontend && npx tsc --noEmit
```

---

## Pricing Updates

Pricing tables are inside each adapter file:

```python
MY_PROVIDER_PRICING = {
    "my-model": {"input": 1.0, "output": 3.0},  # per 1M tokens
}
```

When a provider changes pricing:
1. Update the adapter's pricing dict
2. Update `docs/provider-pricing.md`
3. Update `backend/tests/test_adapters.py` if the cost assertions changed

---

## Code Style

- **Python**: Black formatter (88 char lines), type hints where reasonable
- **TypeScript**: ESLint config in `frontend/`
- **Tests**: pytest (Python) — `pytest tests/ -q` should always be green
- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)

---

## Adding Alert Types

Add new threshold types to `backend/token_tank/alert_engine.py::evaluate_alerts`:

```python
elif alert.threshold_type == "my_type":
    # ... comparison logic ...
    if condition:
        triggered = True
        message = f"...{value}..."
```

Then add tests to `backend/tests/test_alerts.py`.

---

## Questions?

Open an issue on GitHub or check the [architecture docs](docs/architecture.md).
