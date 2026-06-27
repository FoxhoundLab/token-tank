"""First-run setup wizard and LM Studio auto-detection."""

import os
from pathlib import Path

import httpx


def _config_dir() -> Path:
    """Return the ~/.token-tank directory."""
    return Path.home() / ".token-tank"


def check_first_run() -> bool:
    """Return True when no config file exists yet (first-run scenario)."""
    return not _config_dir().joinpath("config.toml").exists()


# ---------------------------------------------------------------------------
# Provider probing
# ---------------------------------------------------------------------------

def _probe_provider_env(provider: str) -> bool:
    """Check whether a provider's API key env var is set."""
    mapping = {
        "anthropic": "ANTHROPIC_API_KEY",
        "zai": "ZAI_API_KEY",
        "minimax": "MINIMAX_API_KEY",
        "openai": "OPENAI_API_KEY",
    }
    key = mapping.get(provider)
    if key is None:
        return False
    val = os.environ.get(key, "").strip()
    return bool(val)


# ---------------------------------------------------------------------------
# LM Studio auto-detect (probe localhost:1234/v1/models)
# ---------------------------------------------------------------------------

def _detect_lm_studio() -> bool:
    """Return True when an LM Studio server is reachable at :1234.

    Sends a GET to http://localhost:1234/v1/models with a short timeout.
    """
    url = "http://localhost:1234/v1/models"
    try:
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(url)
            return resp.status_code == 200
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Full first-run setup
# ---------------------------------------------------------------------------

def run_first_run_setup() -> dict[str, bool]:
    """Probe for known providers and return a status dict.

    Returns e.g.:
        {
            "anthropic": True,
            "openai": False,
            "zai": False,
            "minimax": False,
            "lmstudio": True,  # if reachable
        }

    The ``data_dir`` is created on disk so Settings can use it.  Returns
    the mapping for the caller (e.g. a CLI wizard) to display.
    """
    # Ensure ~/.token-tank exists (but NOT config.toml — that's the signal).
    _config_dir().mkdir(parents=True, exist_ok=True)

    providers = ["anthropic", "openai", "zai", "minimax"]
    result: dict[str, bool] = {}

    for provider in providers:
        result[provider] = _probe_provider_env(provider)

    # LM Studio auto-detect — probe localhost:1234/v1/models.
    result["lmstudio"] = _detect_lm_studio()

    return result
