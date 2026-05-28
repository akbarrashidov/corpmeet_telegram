"""Tests for bot.handlers.start (deep-link QR flow + plain start)."""
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

    with patch("bot.handlers.start.ApiClient") as mock_cls:
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

    with patch("bot.handlers.start.ApiClient") as mock_cls:
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

    with patch("bot.handlers.start.ApiClient") as mock_cls:
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


# ---------- cmd_start ----------

async def test_start_shows_button(monkeypatch: pytest.MonkeyPatch) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    await cmd_start(msg, bot)

    msg.answer.assert_awaited_once()
    args, kwargs = msg.answer.call_args
    assert "CorpMeet" in args[0]
    assert kwargs.get("reply_markup") is not None


# ---------- cmd_start_deep_link — bind_<chat_id> branch ----------

async def test_deep_link_bind_sends_webapp_button_with_chat_title(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`/start bind_-100777` → DM с WebApp кнопкой, в тексте название группы."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()
    chat = MagicMock()
    chat.title = "Команда Альфа"
    bot.get_chat = AsyncMock(return_value=chat)

    await cmd_start_deep_link(msg, make_command("bind_-100777"), bot)

    # consume_session НЕ вызывался
    msg.answer.assert_called_once()
    text, = msg.answer.call_args.args
    assert "Команда Альфа" in text
    keyboard = msg.answer.call_args.kwargs["reply_markup"]
    button = keyboard.inline_keyboard[0][0]
    assert button.web_app is not None
    assert "bind_chat=-100777" in button.web_app.url


async def test_deep_link_bind_fallback_title_when_get_chat_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Если бот не в чате (TelegramForbiddenError) — используем «групповой чат»."""
    from aiogram.exceptions import TelegramForbiddenError
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()
    bot.get_chat = AsyncMock(
        side_effect=TelegramForbiddenError(method=MagicMock(), message="not a member"),
    )

    await cmd_start_deep_link(msg, make_command("bind_-100777"), bot)

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "групповой чат" in text
    keyboard = msg.answer.call_args.kwargs["reply_markup"]
    assert "bind_chat=-100777" in keyboard.inline_keyboard[0][0].web_app.url


async def test_deep_link_bind_invalid_chat_id_falls_back_to_welcome(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`bind_abc` (не число после префикса) → welcome, не падаем."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    await cmd_start_deep_link(msg, make_command("bind_abc"), bot)

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "CorpMeet" in text  # welcome message



# ---------- cmd_start_deep_link — invite_<TOKEN> branch ----------

async def test_deep_link_invite_sends_webapp_with_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`/start invite_ABC123` → WebApp кнопка с ?invite_token=ABC123 в URL."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    await cmd_start_deep_link(msg, make_command("invite_ABC123"), bot)

    msg.answer.assert_called_once()
    keyboard = msg.answer.call_args.kwargs["reply_markup"]
    button = keyboard.inline_keyboard[0][0]
    assert button.web_app is not None
    assert "invite_token=ABC123" in button.web_app.url


async def test_deep_link_invite_empty_token_falls_back_to_welcome(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`/start invite_` (пустой токен после префикса) → welcome."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    await cmd_start_deep_link(msg, make_command("invite_"), bot)

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "CorpMeet" in text


# ---------- cmd_start_deep_link — ws_<CODE> branch ----------

async def test_deep_link_ws_sends_webapp_with_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`/start ws_XYZ789` → WebApp кнопка с ?ws_code=XYZ789 в URL."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    await cmd_start_deep_link(msg, make_command("ws_XYZ789"), bot)

    msg.answer.assert_called_once()
    keyboard = msg.answer.call_args.kwargs["reply_markup"]
    button = keyboard.inline_keyboard[0][0]
    assert button.web_app is not None
    assert "ws_code=XYZ789" in button.web_app.url


async def test_deep_link_ws_empty_code_falls_back_to_welcome(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`/start ws_` (пустой код) → welcome."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    await cmd_start_deep_link(msg, make_command("ws_"), bot)

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "CorpMeet" in text
