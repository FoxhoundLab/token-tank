"""Tests for config file loading and the first-run wizard."""

from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest


class TestConfigFile:
    def test_load_config_file(self, tmp_path):
        """Write TOML, load, verify values."""
        from token_tank.config import load_config_file

        config_path = tmp_path / "config.toml"
        config_path.write_text(
            "[server]\napi_port = 9999\n\n"
            "[proxy]\nproxy_port = 7777\n"
        )

        data = load_config_file(config_path)
        assert data["server"]["api_port"] == 9999
        assert data["proxy"]["proxy_port"] == 7777

    def test_save_config_file(self, tmp_path):
        """Save settings, read back, verify."""
        from token_tank.config import save_config_file, load_config_file, Settings

        config_path = tmp_path / "config.toml"
        config_path.parent.mkdir(parents=True, exist_ok=True)

        settings = Settings(api_port=8888)
        save_config_file(settings, config_path)

        assert config_path.exists()
        data = load_config_file(config_path)
        assert data["server"]["api_port"] == 8888


class TestFirstRun:
    def test_first_run_detected(self, tmp_path, monkeypatch):
        """No config file = first run."""
        from token_tank import wizard

        config_path = tmp_path / "config.toml"
        # Ensure file doesn't exist
        if config_path.exists():
            config_path.unlink()

        monkeypatch.setattr(wizard, "_config_dir", lambda: tmp_path)
        assert wizard.check_first_run() is True

    def test_first_run_not_detected(self, tmp_path, monkeypatch):
        """Config file exists = not first run."""
        from token_tank import wizard

        config_path = tmp_path / "config.toml"
        config_path.write_text("[server]\napi_port = 8000\n")

        monkeypatch.setattr(wizard, "_config_dir", lambda: tmp_path)
        assert wizard.check_first_run() is False


class TestLMStudioAutodetect:
    def test_lmstudio_autodetect_available(self):
        """Mock httpx.Client.get to return 200 = LM Studio reachable."""
        from token_tank import wizard

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_client.get.return_value = mock_resp
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)

        with patch("httpx.Client", return_value=mock_client):
            assert wizard._detect_lm_studio() is True

    def test_lmstudio_autodetect_unavailable(self):
        """Mock httpx.Client to raise = LM Studio unreachable."""
        from token_tank import wizard

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(side_effect=Exception("Connection refused"))
        mock_client.__exit__ = MagicMock(return_value=False)

        with patch("httpx.Client", return_value=mock_client):
            assert wizard._detect_lm_studio() is False
