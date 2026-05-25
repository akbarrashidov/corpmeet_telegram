"""Tests for bot.handlers.group_added (bot added to a group → DM inviter)."""
from unittest.mock import AsyncMock, MagicMock

import pytest

from bot.handlers.group_added import on_added_to_group


def _setup_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "x:y")
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")
    monkeypatch.setenv("WEBAPP_URL", "https://tg.example.com")
    monkeypatch.setenv("BOT_SECRET", "secret-xyz")
    from bot.config import get_settings
    get_settings.cache_clear()


def _make_event(
    *,
    chat_id: int = -100123,
    chat_type: str = "supergroup",
    chat_title: str = "Команда Альфа",
    inviter_id: int | None = 999,
    inviter_username: str | None = "tardigradi",
) -> MagicMock:
    event = MagicMock()
    event.chat.id = chat_id
    event.chat.type = chat_type
    event.chat.title = chat_title
    if inviter_id is None:
        event.from_user = None
    else:
        event.from_user.id = inviter_id
        event.from_user.username = inviter_username
        event.from_user.full_name = "Some User"
    return event


async def test_dm_sent_to_inviter_with_webapp_button(monkeypatch: pytest.MonkeyPatch) -> None:
    _setup_env(monkeypatch)
    bot = MagicMock()
    bot.send_message = AsyncMock()
    event = _make_event(chat_id=-100123)

    await on_added_to_group(event, bot)

    # 1) DM в личку пригласившему (999)
    dm_calls = [c for c in bot.send_message.await_args_list if c.args[0] == 999]
    assert len(dm_calls) == 1
    args, kwargs = dm_calls[0]
    assert "Команда Альфа" in args[1]
    keyboard = kwargs["reply_markup"]
    assert keyboard.inline_keyboard[0][0].web_app is not None
    assert "bind_chat=-100123" in keyboard.inline_keyboard[0][0].web_app.url

    # 2) Hello в группу (-100123)
    group_calls = [c for c in bot.send_message.await_args_list if c.args[0] == -100123]
    assert len(group_calls) == 1
    assert "CorpMeet" in group_calls[0].args[1]


async def test_falls_back_to_group_when_dm_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    _setup_env(monkeypatch)
    bot = MagicMock()
    # DM падает (бот заблокирован), потом успешный group post
    bot.send_message = AsyncMock(side_effect=[Exception("blocked"), None])
    event = _make_event(inviter_username="tardigradi")

    await on_added_to_group(event, bot)

    # 2 вызова: DM падает, потом group fallback
    assert bot.send_message.await_count == 2
    fallback = bot.send_message.await_args_list[1]
    assert "@tardigradi" in fallback.args[1]


async def test_handles_no_inviter(monkeypatch: pytest.MonkeyPatch) -> None:
    """В редких случаях from_user может быть None (channel post auto-add)."""
    _setup_env(monkeypatch)
    bot = MagicMock()
    bot.send_message = AsyncMock()
    event = _make_event(inviter_id=None)

    await on_added_to_group(event, bot)

    # Только сообщение в группу, без DM
    assert bot.send_message.await_count == 1
    assert bot.send_message.await_args.args[0] == -100123
