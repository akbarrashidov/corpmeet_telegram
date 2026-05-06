"""Tests for bot.handlers.start (deep-link, plain start, position registration)."""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from aiogram.filters import CommandObject

from bot.handlers.start import cmd_start, cmd_start_deep_link, on_position_chosen
from bot.services.api_client import EnsureUserResponse


def make_message(user_id: int = 999) -> MagicMock:
    msg = MagicMock()
    msg.from_user.id = user_id
    msg.from_user.first_name = "Артём"
    msg.from_user.last_name = "Искра"
    msg.from_user.username = "ariskra"
    msg.answer = AsyncMock()
    return msg


def make_command(args: str | None) -> CommandObject:
    return CommandObject(prefix="/", command="start", args=args)


def make_bot() -> MagicMock:
    bot = MagicMock()
    bot.get_chat_member = AsyncMock()
    return bot


def make_callback(data: str, user_id: int = 999) -> MagicMock:
    cb = MagicMock()
    cb.from_user.id = user_id
    cb.data = data
    cb.message = MagicMock()
    cb.message.edit_text = AsyncMock()
    cb.message.answer = AsyncMock()
    cb.answer = AsyncMock()
    return cb


def setup_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "x:y")
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    monkeypatch.setenv("WEBAPP_URL", "https://webapp.example.com")
    monkeypatch.setenv("BOT_INTERNAL_SECRET", "secret-xyz")
    from bot.config import get_settings
    get_settings.cache_clear()


def patch_api_client(**method_mocks):
    """Создать mock-context для ApiClient. method_mocks: name=AsyncMock(...)."""
    mock_api = MagicMock()
    mock_api.__aenter__ = AsyncMock(return_value=mock_api)
    mock_api.__aexit__ = AsyncMock(return_value=None)
    for name, mock in method_mocks.items():
        setattr(mock_api, name, mock)
    return mock_api


# ---------- cmd_start_deep_link ----------

async def test_deep_link_calls_consume_session(monkeypatch: pytest.MonkeyPatch) -> None:
    setup_env(monkeypatch)
    msg = make_message(user_id=999)
    bot = make_bot()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(
            consume_session=AsyncMock(return_value={"ok": True})
        )

        await cmd_start_deep_link(msg, make_command("abc-token"), bot)

        mock_cls.return_value.consume_session.assert_awaited_once_with(
            token="abc-token", telegram_id=999
        )
        msg.answer.assert_awaited_once()
        text = msg.answer.call_args.args[0]
        assert "подтверждён" in text.lower()


async def test_deep_link_handles_410_with_friendly_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    fake_response = MagicMock()
    fake_response.status_code = 410
    err = httpx.HTTPStatusError("expired", request=MagicMock(), response=fake_response)

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(
            consume_session=AsyncMock(side_effect=err)
        )

        await cmd_start_deep_link(msg, make_command("expired-token"), bot)

        text = msg.answer.call_args.args[0]
        assert "истекла" in text.lower() or "использована" in text.lower()


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


# ---------- cmd_start (plain) ----------

async def test_start_shows_mini_app_when_position_already_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    ensure_resp = EnsureUserResponse(ok=True, created=False, has_position=True)

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(
            ensure_user=AsyncMock(return_value=ensure_resp)
        )
        await cmd_start(msg, bot)

    msg.answer.assert_awaited_once()
    args, kwargs = msg.answer.call_args
    assert "CorpMeet" in args[0]
    assert kwargs.get("reply_markup") is not None


async def test_start_prompts_for_position_when_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    ensure_resp = EnsureUserResponse(ok=True, created=True, has_position=False)

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(
            ensure_user=AsyncMock(return_value=ensure_resp)
        )
        await cmd_start(msg, bot)

    msg.answer.assert_awaited_once()
    args, kwargs = msg.answer.call_args
    assert "должность" in args[0].lower()
    kb = kwargs.get("reply_markup")
    assert kb is not None
    # 5 кнопок (по одной на строку)
    assert len(kb.inline_keyboard) == 5


async def test_start_passes_user_fields_to_ensure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    msg = make_message(user_id=42)
    msg.from_user.first_name = "Иван"
    msg.from_user.last_name = "Петров"
    msg.from_user.username = "ivan_p"
    bot = make_bot()

    ensure_mock = AsyncMock(
        return_value=EnsureUserResponse(ok=True, created=False, has_position=True)
    )

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(ensure_user=ensure_mock)
        await cmd_start(msg, bot)

    ensure_mock.assert_awaited_once_with(
        telegram_id=42, first_name="Иван", last_name="Петров", username="ivan_p"
    )


async def test_start_handles_ensure_user_failure_gracefully(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(
            ensure_user=AsyncMock(side_effect=RuntimeError("backend down"))
        )
        await cmd_start(msg, bot)

    msg.answer.assert_awaited_once()
    text = msg.answer.call_args.args[0]
    assert "не удалось" in text.lower()


async def test_start_denies_non_group_member(monkeypatch: pytest.MonkeyPatch) -> None:
    setup_env(monkeypatch)
    msg = make_message()
    bot = make_bot()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=False)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        await cmd_start(msg, bot)

        mock_cls.assert_not_called()
        msg.answer.assert_awaited_once()
        text = msg.answer.call_args.args[0]
        assert "нет в группе" in text.lower()


# ---------- on_position_chosen ----------

async def test_position_callback_saves_and_edits_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    cb = make_callback(data="position:PM")
    bot = make_bot()

    set_position_mock = AsyncMock()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(set_position=set_position_mock)
        await on_position_chosen(cb, bot)

    set_position_mock.assert_awaited_once_with(telegram_id=999, position="PM")
    cb.message.edit_text.assert_awaited_once()
    args, kwargs = cb.message.edit_text.call_args
    assert "PM" in args[0]
    assert kwargs.get("reply_markup") is not None
    cb.answer.assert_awaited()


async def test_position_callback_uses_label_in_confirmation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    # api_value="Программист", label="Программист и др."
    cb = make_callback(data="position:Программист")
    bot = make_bot()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(set_position=AsyncMock())
        await on_position_chosen(cb, bot)

    text = cb.message.edit_text.call_args.args[0]
    assert "Программист и др." in text


async def test_position_callback_rejects_unknown_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    cb = make_callback(data="position:Маркетолог")
    bot = make_bot()

    set_position_mock = AsyncMock()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(set_position=set_position_mock)
        await on_position_chosen(cb, bot)

    set_position_mock.assert_not_awaited()
    cb.answer.assert_awaited_once()
    args, kwargs = cb.answer.call_args
    assert "неизвестная" in args[0].lower()
    assert kwargs.get("show_alert") is True


async def test_position_callback_denies_non_member(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    cb = make_callback(data="position:PM")
    bot = make_bot()

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=False)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        await on_position_chosen(cb, bot)

        mock_cls.assert_not_called()
        cb.answer.assert_awaited_once()
        args, kwargs = cb.answer.call_args
        assert "нет в группе" in args[0].lower()
        assert kwargs.get("show_alert") is True


async def test_position_callback_handles_404_user_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    setup_env(monkeypatch)
    cb = make_callback(data="position:PM")
    bot = make_bot()

    fake_response = MagicMock()
    fake_response.status_code = 404
    err = httpx.HTTPStatusError("not found", request=MagicMock(), response=fake_response)

    with patch("bot.handlers.start._has_access", AsyncMock(return_value=True)), \
         patch("bot.handlers.start.ApiClient") as mock_cls:
        mock_cls.return_value = patch_api_client(
            set_position=AsyncMock(side_effect=err)
        )
        await on_position_chosen(cb, bot)

    cb.answer.assert_awaited_once()
    args, kwargs = cb.answer.call_args
    assert "/start" in args[0]
    assert kwargs.get("show_alert") is True
    cb.message.edit_text.assert_not_awaited()
