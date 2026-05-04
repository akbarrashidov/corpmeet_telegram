"""Tests for bot.config."""
import pytest


def test_loads_required_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:abc")
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    monkeypatch.setenv("WEBAPP_URL", "https://webapp.example.com")

    from bot.config import Settings

    s = Settings()

    assert s.telegram_bot_token == "123:abc"
    assert str(s.backend_url).rstrip("/") == "https://api.example.com"
    assert str(s.webapp_url).rstrip("/") == "https://webapp.example.com"


def test_optional_fields_have_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:abc")
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    monkeypatch.setenv("WEBAPP_URL", "https://webapp.example.com")

    from bot.config import Settings

    s = Settings()

    assert s.tg_bot_username == "corpmeet_dev_bot"
    assert s.bot_secret == ""
    assert s.group_id is None


def test_ignores_unrelated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:abc")
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    monkeypatch.setenv("WEBAPP_URL", "https://webapp.example.com")
    monkeypatch.setenv("VITE_API_BASE_URL", "https://anything.com")

    from bot.config import Settings

    s = Settings()  # must not raise

    assert s.telegram_bot_token == "123:abc"


def test_missing_required_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    from pydantic import ValidationError

    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    monkeypatch.setenv("WEBAPP_URL", "https://webapp.example.com")
    # TELEGRAM_BOT_TOKEN intentionally not set

    from bot.config import Settings

    with pytest.raises(ValidationError):
        Settings()


def test_get_settings_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:abc")
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    monkeypatch.setenv("WEBAPP_URL", "https://webapp.example.com")

    from bot.config import get_settings

    get_settings.cache_clear()
    s1 = get_settings()
    s2 = get_settings()

    assert s1 is s2
    get_settings.cache_clear()
