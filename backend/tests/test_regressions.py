"""Regression tests for shipped P0/P1 fixes.

Each test pins a specific bug that previously slipped past the suite:
  - `token-tank start` crashed with NameError (logging not imported)
  - a configured Fernet secret key raised ValueError on encrypt
  - `token_tank init` ignored TOKEN_TANK_DATA_DIR
  - UsageRecordResponse could not serialize ORM objects
"""

import os
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace


def test_cli_setup_logging_does_not_raise():
    """_setup_logging must not raise NameError (module-level logging import)."""
    from token_tank import cli

    cli._setup_logging()  # would raise NameError before the fix


def test_crypto_roundtrip_with_configured_fernet_key(monkeypatch):
    """A documented Fernet.generate_key() value must encrypt/decrypt cleanly."""
    from cryptography.fernet import Fernet
    from token_tank import crypto

    monkeypatch.setenv("TOKEN_TANK_SECRET_KEY", Fernet.generate_key().decode())
    token = crypto.encrypt("sk-secret-value")
    assert crypto.decrypt(token) == "sk-secret-value"


def test_crypto_roundtrip_with_arbitrary_length_key(monkeypatch):
    """Any-length secret is accepted (derived via SHA-256), not just 32 bytes."""
    from token_tank import crypto

    monkeypatch.setenv("TOKEN_TANK_SECRET_KEY", "short")
    token = crypto.encrypt("hello")
    assert crypto.decrypt(token) == "hello"


def test_toml_path_honors_data_dir_env(monkeypatch, tmp_path):
    """_toml_path follows TOKEN_TANK_DATA_DIR so init and load agree."""
    from token_tank import config

    monkeypatch.setenv("TOKEN_TANK_DATA_DIR", str(tmp_path))
    assert config._toml_path() == tmp_path / "config.toml"


def test_init_writes_toml_into_configured_data_dir(monkeypatch, tmp_path):
    """`token_tank init` writes valid TOML into the configured data dir."""
    import tomllib

    from token_tank import cli

    monkeypatch.setenv("TOKEN_TANK_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("TOKEN_TANK_DB_PATH", str(tmp_path / "usage.db"))

    cli._cmd_init(None)

    config_file = tmp_path / "config.toml"
    assert config_file.exists()
    parsed = tomllib.load(config_file.open("rb"))
    assert {"server", "proxy", "database", "crypto"} <= set(parsed)


def test_cli_start_creates_data_dir(monkeypatch, tmp_path):
    """`token-tank start` must create the data dir before writing the PID file."""
    import asyncio

    from token_tank import cli

    data_dir = tmp_path / "fresh-tank"  # does not exist yet
    monkeypatch.setenv("TOKEN_TANK_DATA_DIR", str(data_dir))
    monkeypatch.setenv("TOKEN_TANK_DB_PATH", str(data_dir / "usage.db"))
    monkeypatch.setattr(cli, "_read_existing_pid", lambda: None)
    # Don't actually start servers — just exercise the pre-flight setup.
    monkeypatch.setattr(asyncio, "run", lambda coro: coro.close())

    cli._cmd_start(None)

    assert data_dir.is_dir()
    assert not (data_dir / "token-tank.pid").exists()  # cleaned up in finally


def test_cli_version_flag(capsys):
    """`token-tank --version` prints the package version and exits 0."""
    import pytest

    from token_tank import __version__, cli

    with pytest.raises(SystemExit) as exc:
        cli.main(["--version"])
    assert exc.value.code == 0
    assert __version__ in capsys.readouterr().out


def test_cli_config_flag_targets_explicit_file(monkeypatch, tmp_path):
    """`--config PATH init` writes the config to the given file."""
    from token_tank import cli

    target = tmp_path / "custom.toml"
    monkeypatch.delenv("TOKEN_TANK_CONFIG_FILE", raising=False)
    try:
        cli.main(["--config", str(target), "init"])
        assert target.exists()
    finally:
        # cli.main writes the env var directly; don't leak it to other tests.
        os.environ.pop("TOKEN_TANK_CONFIG_FILE", None)


def test_usage_record_response_serializes_orm_object():
    """UsageRecordResponse has from_attributes for ORM serialization."""
    from token_tank.schemas import UsageRecordResponse

    orm_like = SimpleNamespace(
        provider="anthropic",
        model="claude-sonnet-4",
        input_tokens=10,
        output_tokens=5,
        total_tokens=15,
        estimated_cost=0.01,
        timestamp=datetime.now(timezone.utc),
    )
    resp = UsageRecordResponse.model_validate(orm_like)
    assert resp.total_tokens == 15
