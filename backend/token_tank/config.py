"""Application configuration with TOML file support."""

import os
from pathlib import Path
from typing import Any

try:
    # Python 3.11+ — stdlib
    import tomllib
except ImportError:
    # Fallback for older Python (shouldn't happen — we require 3.11+)
    import tomli as tomllib

from pydantic_settings import BaseSettings, SettingsConfigDict


def _toml_path() -> Path:
    """Return the canonical config file path."""
    return Path.home() / ".token-tank" / "config.toml"


# ---------------------------------------------------------------------------
# Settings class (env vars → defaults)
# ---------------------------------------------------------------------------

class Settings(BaseSettings):
    # Server
    api_host: str = "127.0.0.1"
    api_port: int = 8000

    # Proxy
    proxy_host: str = "127.0.0.1"
    proxy_port: int = 8848

    # Database
    data_dir: Path = Path.home() / ".token-tank"
    db_path: Path = data_dir / "usage.db"

    # Crypto
    secret_key: str = os.environ.get(
        "TOKEN_TANK_SECRET",
        default="",  # Generated on first run if empty
    )

    # Polling
    billing_poll_interval: int = 300  # seconds (5 min)

    # Data retention
    retention_days: int = 90

    # CORS origins (frontend dev server)
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_prefix="TOKEN_TANK_",
        env_file=".env",
    )


def _settings_to_dict(s: Settings) -> dict[str, Any]:
    """Convert a Settings instance to a plain dict (safe for TOML)."""
    d = s.model_dump()
    # Path objects → strings so TOML serialises cleanly.
    for key in ("data_dir", "db_path"):
        if key in d and isinstance(d[key], Path):
            d[key] = str(d[key])
    return d


# ---------------------------------------------------------------------------
# TOML file helpers
# ---------------------------------------------------------------------------

def load_config_file(config_path: Path | None = None) -> dict[str, Any]:
    """Read *config_path* (default ~/.token-tank/config.toml) and return a dict.

    Returns an empty dict when the file does not exist — this is
    intentional so callers can distinguish "missing" from "missing keys".
    """
    if config_path is None:
        config_path = _toml_path()
    if not config_path.exists():
        return {}
    with open(config_path, "rb") as f:
        return tomllib.load(f)


def _merge_toml_into_settings(
    toml_data: dict[str, Any],
) -> Settings:
    """Merge a TOML dict over the default Environment → defaults.

    The merge priority is (highest → lowest):
        1. Active environment variables
        2. TOML file values (section.key)
        3. Settings class defaults

    This function must be called *before* get_settings() because
    pydantic-settings reads env vars at construction time.  To make the
    TOML values visible to Settings we temporarily write them as env vars
    with lower precedence than the real TOKEN_TANK_* ones.

    Simpler approach: build Settings, then mutate it with TOML values
    that were *not* set via env vars.
    """
    settings = Settings()
    toml_data_lower: dict[str, dict[str, Any]] = {}
    for section_name in ("server", "proxy", "database", "crypto"):
        if section_name in toml_data:
            toml_data_lower[section_name] = {
                k.lower(): v for k, v in toml_data[section_name].items()
            }

    # --- server section → api_host, api_port ---
    for key, val in toml_data_lower.get("server", {}).items():
        if hasattr(settings, key):
            current = getattr(settings, key)
            # Only override when env var was NOT set (i.e. still the default).
            env_val = os.environ.get(f"TOKEN_TANK_{key.upper()}")
            if env_val is None:
                setattr(settings, key, val)

    # --- proxy section → proxy_host, proxy_port ---
    for key, val in toml_data_lower.get("proxy", {}).items():
        if hasattr(settings, key):
            env_val = os.environ.get(f"TOKEN_TANK_{key.upper()}")
            if env_val is None:
                setattr(settings, key, val)

    # --- database section → data_dir, db_path ---
    for key, val in toml_data_lower.get("database", {}).items():
        if hasattr(settings, key):
            env_val = os.environ.get(f"TOKEN_TANK_{key.upper()}")
            if env_val is None:
                setattr(settings, key, Path(val))

    # --- crypto section → secret_key ---
    for key, val in toml_data_lower.get("crypto", {}).items():
        if hasattr(settings, key):
            env_val = os.environ.get(f"TOKEN_TANK_{key.upper()}")
            if env_val is None:
                setattr(settings, key, val)

    return settings


def get_settings(config_path: Path | None = None) -> Settings:
    """Get application settings, merging TOML file + env vars.

    Priority (highest → lowest):
        1. Active environment variables (TOKEN_TANK_*)
        2. TOML file values
        3. Settings class defaults
    """
    toml_data = load_config_file(config_path)
    if not toml_data:
        return Settings()
    return _merge_toml_into_settings(toml_data)


def save_config_file(
    settings: Settings, config_path: Path | None = None
) -> None:
    """Write *settings* to a TOML file at *config_path*.

    Creates the parent directory if needed.
    """
    if config_path is None:
        config_path = _toml_path()

    # Build sections for TOML output.
    d: dict[str, Any] = {}

    # server section
    d["server"] = {
        "api_host": settings.api_host,
        "api_port": settings.api_port,
    }

    # proxy section
    d["proxy"] = {
        "proxy_host": settings.proxy_host,
        "proxy_port": settings.proxy_port,
    }

    # database section  — write as strings (Path → str).
    d["database"] = {
        "data_dir": str(settings.data_dir),
        "db_path": str(settings.db_path),
    }

    # crypto section
    d["crypto"] = {
        "secret_key": settings.secret_key,
    }

    # Optional / advanced sections (preserve if present in existing file).
    existing = load_config_file(config_path)
    for extra_section in ("polling", "retention", "cors"):
        if existing and extra_section in existing:
            if extra_section == "polling":
                d["polling"] = {k: v for k, v in existing[extra_section].items()}
            elif extra_section == "retention":
                d["retention"] = {k: v for k, v in existing[extra_section].items()}
            elif extra_section == "cors":
                d["cors"] = {k: v for k, v in existing[extra_section].items()}

    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        # Use a simple manual serializer to avoid an extra dependency.
        _write_toml(f, d)


def _write_toml(file, data: dict[str, Any]) -> None:
    """Minimal TOML writer (no external dependencies)."""
    for section, values in data.items():
        file.write(f"[{section}]\n")
        if isinstance(values, dict):
            for k, v in values.items():
                _write_value(file, str(k), v)
        file.write("\n")


def _write_value(f, key: str, value: Any) -> None:
    """Write a single TOML key=value line."""
    if isinstance(value, bool):
        f.write(f"{key} = {str(value).lower()}\n")
    elif isinstance(value, int):
        f.write(f"{key} = {value}\n")
    elif isinstance(value, float):
        f.write(f"{key} = {value}\n")
    elif isinstance(value, list):
        items = ", ".join(f'"{_toml_str(v)}"' for v in value)
        f.write(f'{key} = [{items}]\n')
    elif isinstance(value, str):
        f.write(f'{key} = "{_toml_str(value)}"\n')
    else:
        f.write(f'{key} = "{value}"\n')


def _toml_str(s: str) -> str:
    """Escape a string for TOML basic string."""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


# ---------------------------------------------------------------------------
# Backwards-compatible helpers
# ---------------------------------------------------------------------------

def ensure_data_dir(settings: Settings) -> None:
    """Create data directory on first run."""
    settings.data_dir.mkdir(parents=True, exist_ok=True)
