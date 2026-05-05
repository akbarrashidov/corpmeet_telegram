"""Tests for bot.tasks.poller."""
import datetime as dt
from unittest.mock import AsyncMock, MagicMock
from zoneinfo import ZoneInfo

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


def make_poller_with_mocked_api(
    *, group_id: int | None = None
) -> tuple[Poller, MagicMock]:
    bot = MagicMock()
    bot.send_message = AsyncMock()
    p = Poller(bot, make_settings(group_id=group_id))
    fake_api = MagicMock()
    fake_api.bookings_since = AsyncMock(return_value=[])
    fake_api.bookings_reminders = AsyncMock(return_value=[])
    fake_api.bookings_deleted_since = AsyncMock(return_value=[])
    fake_api.mark_reminded = AsyncMock()
    fake_api.get_user_telegram_id_by_username = AsyncMock(return_value=None)
    p._api = fake_api
    return p, bot


# ---------- Existing tests (owner DM only path) ----------

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


# ---------- Group notifications ----------

async def test_group_notification_on_new_booking() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_since.return_value = [make_booking(title="Standup")]

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert 999 in chat_ids  # owner
    assert -100 in chat_ids  # group


async def test_group_message_includes_organizer() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_since.return_value = [make_booking()]

    await p._tick()

    group_call = next(
        c for c in bot.send_message.await_args_list if c.args[0] == -100
    )
    assert "👤 Anna" in group_call.args[1]


async def test_group_message_includes_guests_when_present() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    booking = make_booking()
    booking.guests = ["alice", "bob"]
    p._api.bookings_since.return_value = [booking]

    await p._tick()

    group_call = next(
        c for c in bot.send_message.await_args_list if c.args[0] == -100
    )
    assert "👥 alice, bob" in group_call.args[1]


async def test_no_group_id_skips_group_notify() -> None:
    p, bot = make_poller_with_mocked_api()  # group_id=None
    p._api.bookings_since.return_value = [make_booking()]

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert chat_ids == [999]  # only owner, no group


async def test_group_notification_on_deletion() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_deleted_since.return_value = [make_booking()]

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert -100 in chat_ids


async def test_reminder_does_not_notify_group() -> None:
    """Per matrix: reminder goes only to owner+guests DMs, NOT to group."""
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_reminders.return_value = [make_booking()]

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert 999 in chat_ids
    assert -100 not in chat_ids


# ---------- Guest notifications ----------

async def test_guest_dmed_when_username_resolves() -> None:
    p, bot = make_poller_with_mocked_api()
    booking = make_booking()
    booking.guests = ["alice"]
    p._api.bookings_since.return_value = [booking]
    p._api.get_user_telegram_id_by_username.return_value = 555

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert 999 in chat_ids  # owner
    assert 555 in chat_ids  # guest
    p._api.get_user_telegram_id_by_username.assert_awaited_with("alice")


async def test_guest_skipped_silently_when_resolution_returns_none() -> None:
    p, bot = make_poller_with_mocked_api()
    booking = make_booking()
    booking.guests = ["unknown_user"]
    p._api.bookings_since.return_value = [booking]
    p._api.get_user_telegram_id_by_username.return_value = None

    await p._tick()

    assert bot.send_message.await_count == 1  # owner only


async def test_guest_resolution_error_does_not_break_loop() -> None:
    p, bot = make_poller_with_mocked_api()
    booking = make_booking()
    booking.guests = ["broken"]
    p._api.bookings_since.return_value = [booking]
    p._api.get_user_telegram_id_by_username.side_effect = Exception("api down")

    await p._tick()  # not raise

    assert bot.send_message.await_count == 1  # owner still notified


async def test_reminder_notifies_owner_and_guests() -> None:
    p, bot = make_poller_with_mocked_api()
    booking = make_booking(id=42)
    booking.guests = ["alice"]
    p._api.bookings_reminders.return_value = [booking]
    p._api.get_user_telegram_id_by_username.return_value = 555

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert 999 in chat_ids
    assert 555 in chat_ids
    p._api.mark_reminded.assert_awaited_once_with(42)


async def test_deletion_notifies_owner_and_guests_and_group() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    booking = make_booking()
    booking.guests = ["alice"]
    p._api.bookings_deleted_since.return_value = [booking]
    p._api.get_user_telegram_id_by_username.return_value = 555

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert 999 in chat_ids   # owner
    assert 555 in chat_ids   # guest
    assert -100 in chat_ids  # group


# ---------- Group message format (pure functions) ----------

def test_msg_new_booking_group_includes_organizer_and_omits_guests() -> None:
    booking = make_booking(title="Demo")
    text = poller_module.msg_new_booking_group(booking, ZoneInfo("UTC"))
    assert "📌 Новая встреча «Demo»" in text
    assert "👤 Anna" in text
    assert "👥" not in text


def test_msg_new_booking_group_with_guests() -> None:
    booking = make_booking()
    booking.guests = ["alice", "bob"]
    text = poller_module.msg_new_booking_group(booking, ZoneInfo("UTC"))
    assert "👥 alice, bob" in text


def test_msg_changed_booking_group_format() -> None:
    booking = make_booking(title="Sync")
    text = poller_module.msg_changed_booking_group(booking, ZoneInfo("UTC"))
    assert "✏️" in text
    assert "перенесена" in text
    assert "Sync" in text
    assert "👤 Anna" in text


def test_msg_deleted_booking_group_format() -> None:
    booking = make_booking(title="Old")
    text = poller_module.msg_deleted_booking_group(booking, ZoneInfo("UTC"))
    assert "❌" in text
    assert "отменена" in text
    assert "Old" in text
    assert "👤 Anna" in text
