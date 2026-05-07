"""Tests for bot.tasks.poller."""
import datetime as dt
from unittest.mock import AsyncMock, MagicMock
from zoneinfo import ZoneInfo

import pytest

from bot.config import Settings
from bot.services.api_client import BookingBotInfo, GuestInfo, UserBotInfo
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
    guests: list[GuestInfo] | None = None,
    description: str | None = None,
    recurrence: str = "none",
    recurrence_group_id: int | None = None,
    recurrence_until: dt.date | None = None,
    recurrence_days: list[int] | None = None,
) -> BookingBotInfo:
    now = dt.datetime.now(dt.timezone.utc)
    return BookingBotInfo(
        id=id,
        title=title,
        description=description,
        start_time=now + dt.timedelta(hours=1),
        end_time=now + dt.timedelta(hours=2),
        prev_start_time=prev_start,
        prev_end_time=None,
        guests=guests or [],
        reminder_sent=False,
        created_at=now,
        updated_at=now,
        user=UserBotInfo(
            id=1, telegram_id=telegram_id, username=None, display_name="Anna"
        ),
        recurrence=recurrence,
        recurrence_group_id=recurrence_group_id,
        recurrence_until=recurrence_until,
        recurrence_days=recurrence_days,
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
    p._api = fake_api
    return p, bot


# ---------- Owner DM (the simplest path) ----------

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
    booking = make_booking(guests=[
        GuestInfo(name="alice", telegram_id=111),
        GuestInfo(name="bob", telegram_id=None),
    ])
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


# ---------- Guest notifications (using resolved telegram_id from backend) ----------

async def test_guest_dmed_when_telegram_id_present() -> None:
    """Guest with resolved telegram_id receives DM."""
    p, bot = make_poller_with_mocked_api()
    booking = make_booking(guests=[GuestInfo(name="alice", telegram_id=555)])
    p._api.bookings_since.return_value = [booking]

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert 999 in chat_ids  # owner
    assert 555 in chat_ids  # guest alice


async def test_guest_skipped_when_telegram_id_is_null() -> None:
    """Free-form text or unregistered users have telegram_id=None — skipped."""
    p, bot = make_poller_with_mocked_api()
    booking = make_booking(guests=[GuestInfo(name="все PM", telegram_id=None)])
    p._api.bookings_since.return_value = [booking]

    await p._tick()

    assert bot.send_message.await_count == 1  # owner only


async def test_guest_send_failure_does_not_break_loop() -> None:
    """If send_message to guest fails, owner notification still happens."""
    p, bot = make_poller_with_mocked_api()
    booking = make_booking(guests=[GuestInfo(name="alice", telegram_id=555)])
    # First call (owner) succeeds, second (guest) fails
    bot.send_message.side_effect = [None, Exception("fbn"), None]
    p._api.bookings_since.return_value = [booking]

    await p._tick()  # не должен бросить

    # owner + group attempts; even if guest fails, loop continues
    assert bot.send_message.await_count >= 2


async def test_reminder_notifies_owner_and_guests() -> None:
    p, bot = make_poller_with_mocked_api()
    booking = make_booking(
        id=42,
        guests=[GuestInfo(name="alice", telegram_id=555)],
    )
    p._api.bookings_reminders.return_value = [booking]

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert 999 in chat_ids
    assert 555 in chat_ids
    p._api.mark_reminded.assert_awaited_once_with(42)


async def test_deletion_notifies_owner_and_guests_and_group() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    booking = make_booking(guests=[GuestInfo(name="alice", telegram_id=555)])
    p._api.bookings_deleted_since.return_value = [booking]

    await p._tick()

    chat_ids = [call.args[0] for call in bot.send_message.await_args_list]
    assert 999 in chat_ids   # owner
    assert 555 in chat_ids   # guest
    assert -100 in chat_ids  # group


# ---------- Resilience: 5xx → cursor jump to NOW ----------

async def test_since_500_advances_cursor_to_now() -> None:
    import httpx
    from unittest.mock import MagicMock as MM

    p, bot = make_poller_with_mocked_api()
    fake_response = MM()
    fake_response.status_code = 500
    err = httpx.HTTPStatusError("boom", request=MM(), response=fake_response)
    p._api.bookings_since.side_effect = err

    initial_cursor = p._cursor_updated
    await p._tick()

    assert p._cursor_updated > initial_cursor
    bot.send_message.assert_not_awaited()


async def test_since_503_also_advances_cursor() -> None:
    import httpx
    from unittest.mock import MagicMock as MM

    p, bot = make_poller_with_mocked_api()
    fake_response = MM()
    fake_response.status_code = 503
    err = httpx.HTTPStatusError("unavailable", request=MM(), response=fake_response)
    p._api.bookings_since.side_effect = err

    initial_cursor = p._cursor_updated
    await p._tick()

    assert p._cursor_updated > initial_cursor


async def test_since_400_does_not_advance_cursor() -> None:
    """4xx — не наша зона, не двигаем курсор, exception пропагается."""
    import httpx
    from unittest.mock import MagicMock as MM

    p, bot = make_poller_with_mocked_api()
    fake_response = MM()
    fake_response.status_code = 400
    err = httpx.HTTPStatusError("bad request", request=MM(), response=fake_response)
    p._api.bookings_since.side_effect = err

    initial_cursor = p._cursor_updated
    with pytest.raises(httpx.HTTPStatusError):
        await p._tick()

    assert p._cursor_updated == initial_cursor


async def test_deleted_since_500_advances_cursor_to_now() -> None:
    import httpx
    from unittest.mock import MagicMock as MM

    p, bot = make_poller_with_mocked_api()
    fake_response = MM()
    fake_response.status_code = 500
    err = httpx.HTTPStatusError("boom", request=MM(), response=fake_response)
    p._api.bookings_deleted_since.side_effect = err

    initial_cursor = p._cursor_deleted
    await p._tick()

    assert p._cursor_deleted > initial_cursor
    bot.send_message.assert_not_awaited()


# ---------- Group message format (pure functions) ----------

def test_msg_new_booking_group_includes_organizer_and_omits_guests() -> None:
    booking = make_booking(title="Demo")
    text = poller_module.msg_new_booking_group(booking, ZoneInfo("UTC"))
    assert "📌 Новая встреча «Demo»" in text
    assert "👤 Anna" in text
    assert "👥" not in text


def test_msg_new_booking_group_with_guests() -> None:
    booking = make_booking(guests=[
        GuestInfo(name="alice", telegram_id=111),
        GuestInfo(name="bob", telegram_id=None),
    ])
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


# ---------- Local dedup (anti-spam) ----------

async def test_same_booking_returned_twice_notifies_once() -> None:
    """Backend возвращает ту же встречу повторно (commit-trigger spam) —
    мы шлём DM только при первом появлении."""
    p, bot = make_poller_with_mocked_api()
    booking = make_booking(id=100, title="Same")
    p._api.bookings_since.return_value = [booking]

    # Первый тик — нотифицируем
    await p._tick()
    initial_count = bot.send_message.await_count

    # Второй тик с тем же booking — должны проигнорировать
    p._api.bookings_since.return_value = [booking]
    await p._tick()

    assert bot.send_message.await_count == initial_count


async def test_booking_with_changed_time_notifies_again() -> None:
    """Если start/end реально изменились, шлём «перенесена»."""
    p, bot = make_poller_with_mocked_api()
    booking = make_booking(id=200, title="Demo")
    p._api.bookings_since.return_value = [booking]

    # Первый тик — нотификация о создании
    await p._tick()
    first_count = bot.send_message.await_count
    first_text = bot.send_message.call_args.args[1]
    assert "📌" in first_text  # New

    # Меняем start/end
    booking.start_time = booking.start_time + dt.timedelta(hours=1)
    booking.end_time = booking.end_time + dt.timedelta(hours=1)
    p._api.bookings_since.return_value = [booking]

    await p._tick()
    assert bot.send_message.await_count > first_count
    last_text = bot.send_message.call_args.args[1]
    assert "✏️" in last_text  # Changed


async def test_first_sight_with_prev_start_uses_change_message() -> None:
    """Если cache пуст, но booking имеет prev_start_time (= был изменён до того
    как мы его впервые увидели) — шлём «перенесена», не «Новая»."""
    p, bot = make_poller_with_mocked_api()
    past = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)
    p._api.bookings_since.return_value = [make_booking(prev_start=past)]

    await p._tick()

    text = bot.send_message.call_args.args[1]
    assert "✏️" in text
    assert "перенесена" in text


async def test_deletion_dedup() -> None:
    """Backend возвращает удалённую встречу повторно — нотификация только раз."""
    p, bot = make_poller_with_mocked_api()
    booking = make_booking(id=300, title="ToDelete")
    p._api.bookings_deleted_since.return_value = [booking]

    await p._tick()
    first_count = bot.send_message.await_count
    assert first_count > 0

    # Повтор того же удаления
    p._api.bookings_deleted_since.return_value = [booking]
    await p._tick()

    assert bot.send_message.await_count == first_count


async def test_deletion_after_creation_still_notifies() -> None:
    """Если встречу сначала видели в /since, потом она пришла в /deleted-since —
    нотификация об удалении должна прийти."""
    p, bot = make_poller_with_mocked_api()
    booking = make_booking(id=400, title="LifecycleTest")

    # Tick 1: появилась через /since
    p._api.bookings_since.return_value = [booking]
    await p._tick()
    after_create = bot.send_message.await_count

    # Tick 2: пришла через /deleted-since
    p._api.bookings_since.return_value = []
    p._api.bookings_deleted_since.return_value = [booking]
    await p._tick()

    assert bot.send_message.await_count > after_create
    last_text = bot.send_message.call_args.args[1]
    assert "❌" in last_text



# ---------- Description block in messages ----------


def test_msg_new_booking_dm_includes_description() -> None:
    booking = make_booking(description="Zoom: https://zoom.us/j/123\nПовестка: ...")
    text = poller_module.msg_new_booking(booking, ZoneInfo("UTC"))
    assert "📎 Повестка" in text
    assert "https://zoom.us/j/123" in text


def test_msg_new_booking_dm_omits_block_when_no_description() -> None:
    booking = make_booking(description=None)
    text = poller_module.msg_new_booking(booking, ZoneInfo("UTC"))
    assert "📎 Повестка" not in text


def test_msg_new_booking_dm_omits_block_when_whitespace_only() -> None:
    booking = make_booking(description="   \n  \t ")
    text = poller_module.msg_new_booking(booking, ZoneInfo("UTC"))
    assert "📎 Повестка" not in text


def test_msg_changed_booking_includes_description() -> None:
    booking = make_booking(description="https://meet.google.com/abc-defg-hij")
    text = poller_module.msg_changed_booking(booking, ZoneInfo("UTC"))
    assert "📎 Повестка" in text
    assert "https://meet.google.com/abc-defg-hij" in text


def test_msg_deleted_booking_includes_description() -> None:
    booking = make_booking(description="ссылка отменилась")
    text = poller_module.msg_deleted_booking(booking, ZoneInfo("UTC"))
    assert "📎 Повестка" in text


def test_msg_reminder_includes_description() -> None:
    booking = make_booking(description="https://zoom.us/j/123")
    text = poller_module.msg_reminder(booking, ZoneInfo("UTC"))
    assert "📎 Повестка" in text
    assert "https://zoom.us/j/123" in text


def test_msg_new_booking_group_includes_description() -> None:
    booking = make_booking(description="https://zoom.us/j/123")
    text = poller_module.msg_new_booking_group(booking, ZoneInfo("UTC"))
    assert "📎 Повестка" in text
    assert "https://zoom.us/j/123" in text


def test_msg_changed_booking_group_includes_description() -> None:
    booking = make_booking(description="ссылка")
    text = poller_module.msg_changed_booking_group(booking, ZoneInfo("UTC"))
    assert "📎 Повестка" in text


def test_msg_deleted_booking_group_includes_description() -> None:
    booking = make_booking(description="ссылка")
    text = poller_module.msg_deleted_booking_group(booking, ZoneInfo("UTC"))
    assert "📎 Повестка" in text


def test_description_block_strips_outer_whitespace() -> None:
    booking = make_booking(description="\n\n  https://zoom.us/j/1  \n\n")
    text = poller_module.msg_new_booking(booking, ZoneInfo("UTC"))
    # outer whitespace stripped, but URL itself untouched
    assert "https://zoom.us/j/1" in text
    # no double blank lines from leftover whitespace
    assert "\n\n\n\n" not in text

# ---------- Recurrence dedup ----------


async def test_series_first_occurrence_notifies_with_pattern() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_since.return_value = [
        make_booking(
            id=1, recurrence="daily", recurrence_group_id=42, telegram_id=999
        )
    ]

    await p._tick()

    # group + owner DM = 2 calls
    assert bot.send_message.await_count == 2
    group_call = next(
        c for c in bot.send_message.await_args_list if c.args[0] == -100
    )
    text = group_call.args[1]
    assert "🔁" in text
    assert "Каждый день" in text
    assert "Har kuni" in text


async def test_series_sibling_occurrence_silent() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_since.return_value = [
        make_booking(id=1, recurrence="daily", recurrence_group_id=42),
        make_booking(id=2, recurrence="daily", recurrence_group_id=42),
        make_booking(id=3, recurrence="daily", recurrence_group_id=42),
    ]

    await p._tick()

    # Only the first booking triggers notifications: 1 group + 1 owner DM = 2 calls.
    assert bot.send_message.await_count == 2


async def test_series_weekly_with_days_renders_uz_and_ru_labels() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_since.return_value = [
        make_booking(
            id=1,
            recurrence="weekly",
            recurrence_group_id=7,
            recurrence_days=[0, 2],  # Mon, Wed
        )
    ]

    await p._tick()

    group_call = next(
        c for c in bot.send_message.await_args_list if c.args[0] == -100
    )
    text = group_call.args[1]
    assert "Каждую неделю" in text
    assert "Пн" in text and "Ср" in text
    assert "Har hafta" in text
    assert "Du" in text and "Cho" in text


async def test_series_until_renders_in_both_languages() -> None:
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_since.return_value = [
        make_booking(
            id=1,
            recurrence="weekly",
            recurrence_group_id=7,
            recurrence_days=[0],
            recurrence_until=dt.date(2026, 12, 31),
        )
    ]

    await p._tick()

    group_call = next(
        c for c in bot.send_message.await_args_list if c.args[0] == -100
    )
    text = group_call.args[1]
    assert "до 31.12.2026" in text
    assert "31.12.2026 gacha" in text


async def test_series_individual_occurrence_reschedule_still_notifies() -> None:
    """Перенос одной occurrence в уже известной серии — обычное «✏️ перенесена»."""
    p, bot = make_poller_with_mocked_api(group_id=-100)
    # Первый poll: создаются 2 occurrences серии — одна нотификация
    p._api.bookings_since.return_value = [
        make_booking(id=1, recurrence="daily", recurrence_group_id=42),
        make_booking(id=2, recurrence="daily", recurrence_group_id=42),
    ]
    await p._tick()
    initial_count = bot.send_message.await_count
    assert initial_count == 2  # group + owner

    # Второй poll: occurrence id=2 перенесена (другие start/end)
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=5)
    rescheduled = make_booking(
        id=2, recurrence="daily", recurrence_group_id=42, telegram_id=999,
    )
    rescheduled.start_time = later
    rescheduled.end_time = later + dt.timedelta(hours=1)
    p._api.bookings_since.return_value = [rescheduled]
    await p._tick()

    # 2 новых уведомления (group + owner) о переносе
    assert bot.send_message.await_count == initial_count + 2
    last_text = bot.send_message.await_args_list[-1].args[1]
    assert "✏️" in last_text
    assert "перенесена" in last_text


async def test_series_deletion_dedup_by_group() -> None:
    """Удаление серии: backend вернёт все occurrences, шлём один cancellation."""
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_deleted_since.return_value = [
        make_booking(id=1, recurrence="daily", recurrence_group_id=42),
        make_booking(id=2, recurrence="daily", recurrence_group_id=42),
        make_booking(id=3, recurrence="daily", recurrence_group_id=42),
    ]

    await p._tick()

    # Только одно уведомление: group + owner = 2 calls
    assert bot.send_message.await_count == 2
    text = bot.send_message.await_args_list[0].args[1]
    assert "❌" in text


async def test_one_off_booking_unchanged_behavior() -> None:
    """Регрессия: одиночные встречи без recurrence работают как раньше."""
    p, bot = make_poller_with_mocked_api(group_id=-100)
    p._api.bookings_since.return_value = [make_booking(id=1)]

    await p._tick()

    # group + owner
    assert bot.send_message.await_count == 2
    text = bot.send_message.await_args_list[0].args[1]
    # Не должно быть series-блока
    assert "🔁" not in text


async def test_series_reminder_per_occurrence_not_deduped() -> None:
    """15-мин reminder per-occurrence: каждой instance шлём отдельно."""
    p, bot = make_poller_with_mocked_api()
    p._api.bookings_reminders.return_value = [
        make_booking(id=1, recurrence="daily", recurrence_group_id=42),
        make_booking(id=2, recurrence="daily", recurrence_group_id=42),
    ]

    await p._tick()

    # 2 reminder DMs (per-occurrence) — series dedup тут не применяется
    assert bot.send_message.await_count == 2