"""Tests for bot.tasks.poller."""
import datetime as dt
from unittest.mock import AsyncMock, MagicMock

import pytest

from bot.config import Settings
from bot.services.api_client import BookingBotInfo, UserBotInfo
from bot.tasks import poller as poller_module
from bot.tasks.poller import Poller


def make_settings(**overrides) -> Settings:
    defaults = dict(
        telegram_bot_token="x:y",
        backend_url="https://api.example.com",
        webapp_url="https://webapp.example.com",
        bot_secret="secret-xyz",
    )
    return Settings(**{**defaults, **overrides})


def make_booking(
    *,
    id: int = 1,
    title: str = "Standup",
    telegram_id: int | None = 999,
    prev_start: dt.datetime | None = None,
) -> BookingBotInfo:
    now = dt.datetime.now(dt.timezone.utc)
    return BookingBotInfo(
        id=id,
        title=title,
        description=None,
        start_time=now + dt.timedelta(hours=1),
        end_time=now + dt.timedelta(hours=2),
        prev_start_time=prev_start,
        prev_end_time=None,
        guests=[],
        reminder_sent=False,
        created_at=now,
        updated_at=now,
        user=UserBotInfo(
            id=1, telegram_id=telegram_id, username=None, display_name="Anna"
        ),
    )


def make_poller_with_mocked_api() -> tuple[Poller, MagicMock]:
    bot = MagicMock()
    bot.send_message = AsyncMock()
    p = Poller(bot, make_settings())
    fake_api = MagicMock()
    fake_api.bookings_since = AsyncMock(return_value=[])
    fake_api.bookings_reminders = AsyncMock(return_value=[])
    fake_api.bookings_deleted_since = AsyncMock(return_value=[])
    fake_api.mark_reminded = AsyncMock()
    p._api = fake_api
    return p, bot


async def test_new_booking_notification() -> None:
    p, bot = make_poller_with_mocked_api()
    p._api.bookings_since.return_value = [make_booking(title="Standup")]

    await p._tick()

    bot.send_message.assert_awaited_once()
    chat_id, text = bot.send_message.call_args.args
    assert chat_id == 999
    assert "📌" in text
    assert "Standup" in text


async def test_changed_booking_uses_change_message() -> None:
    p, bot = make_poller_with_mocked_api()
    past = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)
    p._api.bookings_since.return_value = [make_booking(prev_start=past)]

    await p._tick()

    text = bot.send_message.call_args.args[1]
    assert "✏️" in text
    assert "перенесена" in text


async def test_reminder_calls_mark_reminded() -> None:
    p, bot = make_poller_with_mocked_api()
    p._api.bookings_reminders.return_value = [make_booking(id=42, title="Demo")]

    await p._tick()

    bot.send_message.assert_awaited_once()
    text = bot.send_message.call_args.args[1]
    assert "⏰" in text
    p._api.mark_reminded.assert_awaited_once_with(42)


async def test_deletion_notification() -> None:
    p, bot = make_poller_with_mocked_api()
    p._api.bookings_deleted_since.return_value = [make_booking(title="Cancelled")]

    await p._tick()

    text = bot.send_message.call_args.args[1]
    assert "❌" in text
    assert "Cancelled" in text


async def test_user_without_telegram_id_skipped() -> None:
    p, bot = make_poller_with_mocked_api()
    p._api.bookings_since.return_value = [make_booking(telegram_id=None)]

    await p._tick()

    bot.send_message.assert_not_awaited()


async def test_send_message_failure_does_not_break_loop() -> None:
    """Если send_message упал на одном букинге, остальные обрабатываются."""
    p, bot = make_poller_with_mocked_api()
    bot.send_message.side_effect = [Exception("boom"), None]
    p._api.bookings_since.return_value = [
        make_booking(id=1, telegram_id=111),
        make_booking(id=2, telegram_id=222),
    ]

    await p._tick()  # не должен бросить

    assert bot.send_message.await_count == 2


async def test_cursor_advances_after_update() -> None:
    p, bot = make_poller_with_mocked_api()
    future = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5)
    booking = make_booking()
    booking.updated_at = future
    p._api.bookings_since.return_value = [booking]

    initial_cursor = p._cursor_updated
    await p._tick()

    assert p._cursor_updated > initial_cursor
    assert p._cursor_updated == future


async def test_mark_reminded_failure_does_not_break_others() -> None:
    p, bot = make_poller_with_mocked_api()
    p._api.mark_reminded.side_effect = [Exception("fail"), None]
    p._api.bookings_reminders.return_value = [
        make_booking(id=1, telegram_id=111),
        make_booking(id=2, telegram_id=222),
    ]

    await p._tick()  # не должен бросить

    assert bot.send_message.await_count == 2
    assert p._api.mark_reminded.await_count == 2
