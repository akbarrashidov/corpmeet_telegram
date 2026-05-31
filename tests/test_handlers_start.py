"""Tests for bot.handlers.start (deep-link QR/invite/ws/bind + plain start)."""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from aiogram.filters import CommandObject

from bot.handlers.start import cmd_start, cmd_start_deep_link


def make_message(
    user_id: int = 999,
    *,
    username: str | None = "testuser",
    first_name: str = "Test",
    last_name: str | None = "User",
    language_code: str | None = "en",
) -> MagicMock:
    msg = MagicMock()
    msg.from_user.id = user_id
    msg.from_user.username = username
    msg.from_user.first_name = first_name
    msg.from_user.last_name = last_name
    msg.from_user.language_code = language_code
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


def patch_api_client(consume_result=None, consume_error: Exception | None = None):
    """Хелпер: ApiClient context-manager c замоканным consume_session."""
    mock_api = MagicMock()
    mock_api.__aenter__ = AsyncMock(return_value=mock_api)
    mock_api.__aexit__ = AsyncMock(return_value=None)
    if consume_error is not None:
        mock_api.consume_session = AsyncMock(side_effect=consume_error)
    else:
        mock_api.consume_session = AsyncMock(
            return_value=consume_result or {"ok": True},
        )
    return mock_api


def http_status_error(status_code: int) -> httpx.HTTPStatusError:
    fake_response = MagicMock()
    fake_response.status_code = status_code
    return httpx.HTTPStatusError("err", request=MagicMock(), response=fake_response)


# ---------- cmd_start_deep_link — QR-flow ----------

async def test_deep_link_qr_calls_consume_session(monkeypatch: pytest.MonkeyPatch) -> None:
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    mock_api = patch_api_client()
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
        await cmd_start_deep_link(msg, make_command("abc-token"), bot)

        mock_api.consume_session.assert_awaited_once_with(
            token="abc-token",
            telegram_id=999,
            first_name="Test",
            last_name="User",
            username="testuser",
            language_code="en",
        )
        msg.answer.assert_awaited_once()
        text = msg.answer.call_args.args[0]
        assert "подтверждён" in text.lower()
        # Mini App кнопка прикреплена
        assert msg.answer.call_args.kwargs.get("reply_markup") is not None


async def test_deep_link_qr_incomplete_profile_no_tg_last_name_shows_nudge(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """profile_complete=False + у TG нет last_name → nudge заполнить имя/фамилию."""
    setup_env(monkeypatch)
    msg = make_message(last_name=None)
    bot = make_bot()

    mock_api = patch_api_client(consume_result={"ok": True, "profile_complete": False})
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
        await cmd_start_deep_link(msg, make_command("abc-token"), bot)

    msg.answer.assert_awaited_once()
    text = msg.answer.call_args.args[0]
    assert "имя" in text.lower() or "фамилию" in text.lower()
    assert msg.answer.call_args.kwargs.get("reply_markup") is not None

async def test_deep_link_qr_incomplete_profile_with_tg_name_skips_nudge(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """profile_complete=False, НО у TG есть first+last_name → стандартное OK сообщение.

    Защита от стейл-флага бэка (он ещё считает profile_complete по legacy
    user.position, который мы больше не заполняем).
    """
    setup_env(monkeypatch)
    msg = make_message(first_name="Alice", last_name="Smith")
    bot = make_bot()

    mock_api = patch_api_client(consume_result={"ok": True, "profile_complete": False})
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
        await cmd_start_deep_link(msg, make_command("abc-token"), bot)

    msg.answer.assert_awaited_once()
    text = msg.answer.call_args.args[0]
    assert "имя" not in text.lower() and "фамилию" not in text.lower()
    assert "вход подтверждён" in text.lower()


@pytest.mark.parametrize("status_code", [404, 410, 422, 500])
async def test_deep_link_qr_error_falls_back_to_welcome(
    monkeypatch: pytest.MonkeyPatch, status_code: int,
) -> None:
    """QR-flow: любая HTTPError → welcome (без специфичных сообщений)."""
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    mock_api = patch_api_client(consume_error=http_status_error(status_code))
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
        await cmd_start_deep_link(msg, make_command("bad-token"), bot)

        msg.answer.assert_awaited_once()
        args, kwargs = msg.answer.call_args
        assert "CorpMeet" in args[0]
        assert kwargs.get("reply_markup") is not None


async def test_deep_link_qr_unexpected_error_falls_back_to_welcome(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    mock_api = patch_api_client(consume_error=RuntimeError("oops"))
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
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
    """`bind_abc` (не число после префикса) → welcome."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    await cmd_start_deep_link(msg, make_command("bind_abc"), bot)

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "CorpMeet" in text


# ---------- cmd_start_deep_link — invite_<TOKEN> branch ----------

async def test_deep_link_invite_calls_consume_session_with_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`/start invite_ABC123` → consume_session('invite_ABC123', tg_id) + DM с greeting + Mini App кнопка БЕЗ params."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    mock_api = patch_api_client()
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
        await cmd_start_deep_link(msg, make_command("invite_ABC123"), bot)

        mock_api.consume_session.assert_awaited_once_with(
            token="invite_ABC123",
            telegram_id=999,
            first_name="Test",
            last_name="User",
            username="testuser",
            language_code="en",
        )

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "пространство" in text.lower()
    keyboard = msg.answer.call_args.kwargs["reply_markup"]
    button = keyboard.inline_keyboard[0][0]
    assert button.web_app is not None
    # URL без params — claim уже сделан на бэке
    assert "invite_token" not in button.web_app.url
    assert "?" not in button.web_app.url


@pytest.mark.parametrize(
    "status_code,expected_phrase",
    [
        (410, "уже использована"),
        (404, "не сработала"),
        (422, "истекла или была отозвана"),
        (500, "временно недоступен"),
    ],
)
async def test_deep_link_invite_error_shows_specific_message(
    monkeypatch: pytest.MonkeyPatch, status_code: int, expected_phrase: str,
) -> None:
    """Invite + HTTPError → специфичное сообщение + Mini App кнопка для восстановления."""
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    mock_api = patch_api_client(consume_error=http_status_error(status_code))
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
        await cmd_start_deep_link(msg, make_command("invite_BADTOKEN"), bot)

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert expected_phrase in text.lower()
    assert msg.answer.call_args.kwargs.get("reply_markup") is not None


async def test_deep_link_invite_unexpected_error_shows_5xx_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Сетевая ошибка → текст про временную недоступность сервера."""
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    mock_api = patch_api_client(consume_error=RuntimeError("network down"))
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
        await cmd_start_deep_link(msg, make_command("invite_ABC"), bot)

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "временно недоступен" in text.lower()


async def test_deep_link_invite_empty_token_falls_back_to_welcome(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`/start invite_` (пустой токен) → welcome, consume_session не вызывается."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    with patch("bot.handlers.start.ApiClient") as mock_cls:
        await cmd_start_deep_link(msg, make_command("invite_"), bot)
        mock_cls.assert_not_called()

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "CorpMeet" in text


# ---------- cmd_start_deep_link — ws_<CODE> branch ----------

async def test_deep_link_ws_calls_consume_session_with_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`/start ws_XYZ789` → consume_session('ws_XYZ789', tg_id) + DM с greeting + Mini App кнопка БЕЗ params."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    mock_api = patch_api_client()
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
        await cmd_start_deep_link(msg, make_command("ws_XYZ789"), bot)

        mock_api.consume_session.assert_awaited_once_with(
            token="ws_XYZ789",
            telegram_id=999,
            first_name="Test",
            last_name="User",
            username="testuser",
            language_code="en",
        )

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "пространство" in text.lower()
    keyboard = msg.answer.call_args.kwargs["reply_markup"]
    button = keyboard.inline_keyboard[0][0]
    assert button.web_app is not None
    assert "ws_code" not in button.web_app.url
    assert "?" not in button.web_app.url


@pytest.mark.parametrize(
    "status_code,expected_phrase",
    [
        (410, "уже использована"),
        (404, "не сработала"),
        (422, "истекла или была отозвана"),
        (500, "временно недоступен"),
    ],
)
async def test_deep_link_ws_error_shows_specific_message(
    monkeypatch: pytest.MonkeyPatch, status_code: int, expected_phrase: str,
) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    mock_api = patch_api_client(consume_error=http_status_error(status_code))
    with patch("bot.handlers.start.ApiClient", return_value=mock_api):
        await cmd_start_deep_link(msg, make_command("ws_BAD"), bot)

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert expected_phrase in text.lower()
    assert msg.answer.call_args.kwargs.get("reply_markup") is not None


async def test_deep_link_ws_empty_code_falls_back_to_welcome(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`/start ws_` (пустой код) → welcome."""
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    with patch("bot.handlers.start.ApiClient") as mock_cls:
        await cmd_start_deep_link(msg, make_command("ws_"), bot)
        mock_cls.assert_not_called()

    msg.answer.assert_called_once()
    text = msg.answer.call_args.args[0]
    assert "CorpMeet" in text
