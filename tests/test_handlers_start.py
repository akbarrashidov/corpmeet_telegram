"""Tests for bot.handlers.start (deep-link QR flow + plain start + access gate)."""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from aiogram.filters import CommandObject

from bot.handlers.start import cmd_start, cmd_start_deep_link


def make_message(user_id: int = 999) -> MagicMock:
    msg = MagicMock()
    msg.from_user.id = user_id
    msg.answer = AsyncMock()
    return msg


def make_command(args: str | None) -> CommandObject:
    return CommandObject(prefix="/", command="start", args=args)


def make_bot() -> MagicMock:
    bot = MagicMock()
    bot.get_chat_member = AsyncMock()
    return bot


def setup_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "x:y")
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    monkeypatch.setenv("WEBAPP_URL", "https://webapp.example.com")
    monkeypatch.setenv("BOT_INTERNAL_SECRET", "secret-xyz")
    from bot.config import get_settings
    get_settings.cache_clear()


# ---------- cmd_start_deep_link ----------

async def test_deep_link_calls_consume_session(monkeypatch: pytest.MonkeyPatch) -> None:
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_api = MagicMock()
        mock_api.__aenter__ = AsyncMock(return_value=mock_api)
        mock_api.__aexit__ = AsyncMock(return_value=None)
        mock_api.consume_session = AsyncMock(return_value={"ok": True})
        mock_cls.return_value = mock_api

        await cmd_start_deep_link(msg, make_command("abc-token"), bot)

        mock_api.consume_session.assert_awaited_once_with(
            token="abc-token", telegram_id=999
        )
        msg.answer.assert_awaited_once()
        text = msg.answer.call_args.args[0]
        assert "подтверждён" in text.lower()


@pytest.mark.parametrize("status_code", [404, 410, 422, 500])
async def test_deep_link_error_falls_back_to_welcome(
    monkeypatch: pytest.MonkeyPatch, status_code: int
) -> None:
    """Любая HTTP-ошибка consume_session → приветствие с кнопкой Mini App,
    а не error-сообщение. Это улучшает UX новых пользователей."""
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    fake_response = MagicMock()
    fake_response.status_code = status_code
    err = httpx.HTTPStatusError("err", request=MagicMock(), response=fake_response)

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_api = MagicMock()
        mock_api.__aenter__ = AsyncMock(return_value=mock_api)
        mock_api.__aexit__ = AsyncMock(return_value=None)
        mock_api.consume_session = AsyncMock(side_effect=err)
        mock_cls.return_value = mock_api

        await cmd_start_deep_link(msg, make_command("bad-token"), bot)

        msg.answer.assert_awaited_once()
        args, kwargs = msg.answer.call_args
        assert "CorpMeet" in args[0]
        assert kwargs.get("reply_markup") is not None  # welcome button attached


async def test_deep_link_unexpected_error_falls_back_to_welcome(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Не-HTTP исключение (сетевая ошибка, etc) — тоже fallback на welcome."""
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_api = MagicMock()
        mock_api.__aenter__ = AsyncMock(return_value=mock_api)
        mock_api.__aexit__ = AsyncMock(return_value=None)
        mock_api.consume_session = AsyncMock(side_effect=RuntimeError("oops"))
        mock_cls.return_value = mock_api

        await cmd_start_deep_link(msg, make_command("any-token"), bot)

        msg.answer.assert_awaited_once()
        args, kwargs = msg.answer.call_args
        assert "CorpMeet" in args[0]
        assert kwargs.get("reply_markup") is not None


async def test_deep_link_empty_token_does_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    with patch("bot.handlers.start.ApiClient") as mock_cls:
        await cmd_start_deep_link(msg, make_command(""), bot)

        mock_cls.assert_not_called()
        msg.answer.assert_not_awaited()


async def test_deep_link_denies_non_member(monkeypatch: pytest.MonkeyPatch) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=False)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        await cmd_start_deep_link(msg, make_command("any-token"), bot)

        mock_cls.assert_not_called()
        msg.answer.assert_awaited_once()
        text = msg.answer.call_args.args[0]
        assert "нет в группе" in text.lower()


# ---------- cmd_start ----------

async def test_start_shows_button_for_member(monkeypatch: pytest.MonkeyPatch) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)):
        await cmd_start(msg, bot)

    msg.answer.assert_awaited_once()
    args, kwargs = msg.answer.call_args
    assert "CorpMeet" in args[0]
    assert kwargs.get("reply_markup") is not None
