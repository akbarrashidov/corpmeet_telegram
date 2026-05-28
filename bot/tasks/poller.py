"""Background poller — checks backend for new/changed/deleted bookings and sends notifications."""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import httpx

from aiogram import Bot

from bot.config import Settings
from bot.services.api_client import ApiClient, BookingBotInfo, GuestInfo

logger = logging.getLogger(__name__)

POLL_INTERVAL = 60.0


# ── Базовые форматтеры ──────────────────────────────────────────────────────


def format_time_range(b: BookingBotInfo, tz: ZoneInfo) -> str:
    """'<dd.mm> <hh:mm>–<hh:mm>' in the given timezone."""
    start = b.start_time.astimezone(tz)
    end = b.end_time.astimezone(tz)
    return f"{start:%d.%m} {start:%H:%M}–{end:%H:%M}"


def format_time_change(b: BookingBotInfo, tz: ZoneInfo) -> str:
    """Для reschedule: '<prev> → <new>'. Если prev отсутствует — только new."""
    if b.prev_start_time is None and b.prev_end_time is None:
        return format_time_range(b, tz)
    prev_start = (b.prev_start_time or b.start_time).astimezone(tz)
    prev_end = (b.prev_end_time or b.end_time).astimezone(tz)
    new_start = b.start_time.astimezone(tz)
    new_end = b.end_time.astimezone(tz)
    prev_str = f"{prev_start:%d.%m} {prev_start:%H:%M}–{prev_end:%H:%M}"
    new_str = f"{new_start:%d.%m} {new_start:%H:%M}–{new_end:%H:%M}"
    return f"{prev_str} → {new_str}"


def _action(uz: str, ru: str) -> str:
    """Бил-action: 'uz / ru'."""
    return f"{uz} / {ru}"


def _room_line(b: BookingBotInfo) -> str:
    if not b.room_name:
        return ""
    return f"\n🚪 {b.room_name}"


def _organizer_line(b: BookingBotInfo) -> str:
    return f"\n👤 {b.user.display_name}"


def _guests_line_block(b: BookingBotInfo) -> str:
    if not b.guests:
        return ""
    return f"\n👥 {', '.join(g.name for g in b.guests)}"


def _description_block(b: BookingBotInfo) -> str:
    if not b.description or not b.description.strip():
        return ""
    return f"\n\n📎 Повестка / Tavsif:\n{b.description.strip()}"


def _attachments_block(b: BookingBotInfo) -> str:
    if not b.has_attachments:
        return ""
    return (
        "\n\n📂 К встрече прикреплён файл / Uchrashuvga fayl biriktirilgan\n"
        "→ corpmeet.uz"
    )


def _footer(b: BookingBotInfo) -> str:
    return _description_block(b) + _attachments_block(b)


# ── Серийные встречи: форматирование паттерна повторения ─────────────────────


_DAY_LABELS_RU = ("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")
_DAY_LABELS_UZ = ("Du", "Se", "Cho", "Pa", "Ju", "Sha", "Yak")


def _format_recurrence(b: BookingBotInfo) -> tuple[str, str]:
    """Возвращает (uz, ru) описание паттерна повторения."""
    days = b.recurrence_days or []

    if b.recurrence == "daily":
        uz = "Har kuni"
        ru = "Каждый день"
    elif b.recurrence == "weekly":
        if days:
            ru_days = ", ".join(_DAY_LABELS_RU[d] for d in days if 0 <= d <= 6)
            uz_days = ", ".join(_DAY_LABELS_UZ[d] for d in days if 0 <= d <= 6)
            uz = f"Har hafta: {uz_days}"
            ru = f"Каждую неделю: {ru_days}"
        else:
            uz = "Har hafta"
            ru = "Каждую неделю"
    elif b.recurrence == "custom":
        if days:
            ru_days = ", ".join(_DAY_LABELS_RU[d] for d in days if 0 <= d <= 6)
            uz_days = ", ".join(_DAY_LABELS_UZ[d] for d in days if 0 <= d <= 6)
            uz = f"Tanlangan kunlarda: {uz_days}"
            ru = f"По выбранным дням: {ru_days}"
        else:
            uz = "Tanlangan kunlarda"
            ru = "По выбранным дням"
    else:
        return ("", "")

    if b.recurrence_until is not None:
        until = b.recurrence_until.strftime("%d.%m.%Y")
        uz = f"{uz} ({until} gacha)"
        ru = f"{ru} (до {until})"

    return (uz, ru)


def _series_line(b: BookingBotInfo) -> str:
    """Compact-блок 🔁: '\\n🔁 uz / ru'."""
    if b.recurrence == "none" or b.recurrence_group_id is None:
        return ""
    uz, ru = _format_recurrence(b)
    if not uz and not ru:
        return ""
    return f"\n🔁 {_action(uz, ru)}"


# ── Сборка сообщений: одноязычная структура с бил-action ─────────────────────


def msg_new_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"📌 «{b.title}» — {_action('yangi uchrashuv', 'новая встреча')}"
    body = f"\n{format_time_range(b, tz)}{_room_line(b)}{_series_line(b)}"
    return head + body + _footer(b)


def msg_changed_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"✏️ «{b.title}» — {_action("vaqti o'zgartirildi", 'перенесена')}"
    body = f"\n{format_time_change(b, tz)}{_room_line(b)}"
    return head + body + _footer(b)


def msg_deleted_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"❌ «{b.title}» — {_action('bekor qilindi', 'отменена')}"
    body = f"\n{format_time_range(b, tz)}{_room_line(b)}"
    return head + body + _description_block(b)


def msg_reminder(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"⏰ {_action('15 daqiqadan', 'Через 15 минут')} — «{b.title}»"
    body = f"\n{format_time_range(b, tz)}{_room_line(b)}"
    return head + body + _footer(b)


# Гостевые версии: + organizer
def msg_new_booking_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"📌 «{b.title}» — {_action('yangi uchrashuv', 'новая встреча')}"
    body = f"\n{format_time_range(b, tz)}{_organizer_line(b)}{_room_line(b)}{_series_line(b)}"
    return head + body + _footer(b)


def msg_changed_booking_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"✏️ «{b.title}» — {_action("vaqti o'zgartirildi", 'перенесена')}"
    body = f"\n{format_time_change(b, tz)}{_organizer_line(b)}{_room_line(b)}"
    return head + body + _footer(b)


def msg_deleted_booking_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"❌ «{b.title}» — {_action('bekor qilindi', 'отменена')}"
    body = f"\n{format_time_range(b, tz)}{_organizer_line(b)}{_room_line(b)}"
    return head + body + _description_block(b)


def msg_reminder_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"⏰ {_action('15 daqiqadan', 'Через 15 минут')} — «{b.title}»"
    body = f"\n{format_time_range(b, tz)}{_organizer_line(b)}{_room_line(b)}"
    return head + body + _footer(b)


# Групповые версии: + organizer + guests-line
def msg_new_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"📌 «{b.title}» — {_action('yangi uchrashuv', 'новая встреча')}"
    body = (
        f"\n{format_time_range(b, tz)}"
        f"{_organizer_line(b)}{_room_line(b)}{_guests_line_block(b)}{_series_line(b)}"
    )
    return head + body + _footer(b)


def msg_changed_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"✏️ «{b.title}» — {_action("vaqti o'zgartirildi", 'перенесена')}"
    body = f"\n{format_time_change(b, tz)}{_organizer_line(b)}{_room_line(b)}"
    return head + body + _footer(b)


def msg_deleted_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"❌ «{b.title}» — {_action('bekor qilindi', 'отменена')}"
    body = f"\n{format_time_range(b, tz)}{_organizer_line(b)}{_room_line(b)}"
    return head + body + _description_block(b)


# Owner-only: гость отказался
def msg_guest_declined(b: BookingBotInfo, declined: GuestInfo, tz: ZoneInfo) -> str:
    head = (
        f"🚫 «{b.title}» — "
        f"{_action('ishtirokchilar ishtirok eta olmaydi', 'гость не сможет принять участие')}"
    )
    body = f"\n{format_time_range(b, tz)}{_room_line(b)}\n🚫 {declined.name}"
    return head + body + _description_block(b)


# Owner-only: предупреждение что чат не привязан
def msg_no_chat_warning(b: BookingBotInfo) -> str:
    return (
        "ℹ️ Чат для уведомлений ещё не привязан / Bildirishnomalar uchun chat hali ulanmagan\n"
        "В новой встрече, переносе или отмене группа их не получит. "
        "Привяжите чат через Настройки → Telegram в Mini App."
    )


# ── Poller ───────────────────────────────────────────────────────────────────


class Poller:
    """Owns ApiClient + asyncio task + cursors + dedup state."""

    def __init__(self, bot: Bot, settings: Settings) -> None:
        self._bot = bot
        self._settings = settings
        self._tz = settings.tz
        self._api = ApiClient(settings)
        self._task: Optional[asyncio.Task] = None
        now = datetime.now(timezone.utc)
        self._cursor_updated = now
        self._cursor_deleted = now
        self._notified_state: dict[int, tuple[datetime, datetime]] = {}
        self._notified_deletions: set[int] = set()
        self._notified_groups: set[int] = set()
        self._cancelled_groups: set[int] = set()
        self._guests_state: dict[int, list[GuestInfo]] = {}
        self._declined_groups: dict[int, set[str]] = {}
        # «уже предупредили owner'а workspace X что чат не привязан» —
        # чтобы не спамить на каждое событие
        self._workspace_chat_warned: set[int] = set()

    async def start(self) -> None:
        await self._api.__aenter__()
        await self.warmup()
        self._task = asyncio.create_task(self._run(), name="bot-poller")
        logger.info("Poller started (interval=%ss)", POLL_INTERVAL)

    async def warmup(self) -> None:
        """Подтягиваем все ранее известные upcoming bookings в dedup-состояние."""
        epoch = datetime(2020, 1, 1, tzinfo=timezone.utc)
        try:
            bookings = await self._api.bookings_since(epoch)
        except Exception:  # noqa: BLE001
            logger.exception("Warmup fetch failed — будем работать без preload")
            return
        for b in bookings:
            self._notified_state[b.id] = (b.start_time, b.end_time)
            self._guests_state[b.id] = list(b.guests)
            if b.recurrence != "none" and b.recurrence_group_id is not None:
                self._notified_groups.add(b.recurrence_group_id)
        logger.info("Warmup loaded %d bookings into dedup state", len(bookings))

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        await self._api.__aexit__(None, None, None)
        logger.info("Poller stopped")

    async def _run(self) -> None:
        while True:
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                logger.exception("Poller tick failed — will retry")
            try:
                await asyncio.sleep(POLL_INTERVAL)
            except asyncio.CancelledError:
                raise

    async def _tick(self) -> None:
        await self._poll_updates()
        await self._poll_reminders()
        await self._poll_deletions()

    async def _poll_updates(self) -> None:
        try:
            bookings = await self._api.bookings_since(self._cursor_updated)
        except httpx.HTTPStatusError as e:
            if 500 <= e.response.status_code < 600:
                now = datetime.now(timezone.utc)
                logger.warning(
                    "bookings/since %s — advancing cursor from %s to %s",
                    e.response.status_code, self._cursor_updated, now,
                )
                self._cursor_updated = now
                return
            raise
        bookings = sorted(bookings, key=lambda x: (x.start_time, x.id))
        for b in bookings:
            await self._detect_guest_declines(b)
            self._guests_state[b.id] = list(b.guests)

            cached = self._notified_state.get(b.id)
            current = (b.start_time, b.end_time)

            if cached is None:
                is_change = b.prev_start_time is not None or b.prev_end_time is not None
                is_series_create = (
                    not is_change
                    and b.recurrence != "none"
                    and b.recurrence_group_id is not None
                )

                if is_series_create and b.recurrence_group_id in self._notified_groups:
                    logger.debug(
                        "Skip series sibling %s (group %s already notified)",
                        b.id, b.recurrence_group_id,
                    )
                    self._notified_state[b.id] = current
                    if b.updated_at > self._cursor_updated:
                        self._cursor_updated = b.updated_at
                    continue

                if is_change:
                    owner_text = msg_changed_booking(b, self._tz)
                    guest_text = msg_changed_booking_guest(b, self._tz)
                    group_text = msg_changed_booking_group(b, self._tz)
                else:
                    owner_text = msg_new_booking(b, self._tz)
                    guest_text = msg_new_booking_guest(b, self._tz)
                    group_text = msg_new_booking_group(b, self._tz)
                await self._notify_owner(b, owner_text)
                await self._notify_guests(b, guest_text)
                await self._notify_group(b, group_text)
                self._notified_state[b.id] = current
                if is_series_create and b.recurrence_group_id is not None:
                    self._notified_groups.add(b.recurrence_group_id)
            elif cached != current:
                owner_text = msg_changed_booking(b, self._tz)
                guest_text = msg_changed_booking_guest(b, self._tz)
                group_text = msg_changed_booking_group(b, self._tz)
                await self._notify_owner(b, owner_text)
                await self._notify_guests(b, guest_text)
                await self._notify_group(b, group_text)
                self._notified_state[b.id] = current
            else:
                logger.debug(
                    "Skip duplicate notification for booking %s (no time change)",
                    b.id,
                )

            if b.updated_at > self._cursor_updated:
                self._cursor_updated = b.updated_at

    async def _detect_guest_declines(self, b: BookingBotInfo) -> None:
        """Если у booking сократился guests с прошлого poll'а — шлём DM organizer'у."""
        prev_guests = self._guests_state.get(b.id)
        if prev_guests is None:
            return
        prev_names = {g.name for g in prev_guests}
        cur_names = {g.name for g in b.guests}
        for removed_name in prev_names - cur_names:
            declined = next((g for g in prev_guests if g.name == removed_name), None)
            if declined is None:
                continue
            if b.recurrence_group_id is not None:
                bucket = self._declined_groups.setdefault(b.recurrence_group_id, set())
                if removed_name in bucket:
                    continue
                bucket.add(removed_name)
            text = msg_guest_declined(b, declined, self._tz)
            await self._notify_owner(b, text)

    async def _poll_reminders(self) -> None:
        bookings = await self._api.bookings_reminders()
        for b in bookings:
            owner_text = msg_reminder(b, self._tz)
            guest_text = msg_reminder_guest(b, self._tz)
            await self._notify_owner(b, owner_text)
            await self._notify_guests(b, guest_text)
            try:
                await self._api.mark_reminded(b.id)
            except Exception:  # noqa: BLE001
                logger.exception("mark-reminded failed for booking %s", b.id)

    async def _poll_deletions(self) -> None:
        try:
            bookings = await self._api.bookings_deleted_since(self._cursor_deleted)
        except httpx.HTTPStatusError as e:
            if 500 <= e.response.status_code < 600:
                now = datetime.now(timezone.utc)
                logger.warning(
                    "bookings/deleted-since %s — advancing cursor from %s to %s",
                    e.response.status_code, self._cursor_deleted, now,
                )
                self._cursor_deleted = now
                return
            raise
        bookings = sorted(bookings, key=lambda x: (x.start_time, x.id))
        for b in bookings:
            is_series = (
                b.recurrence != "none" and b.recurrence_group_id is not None
            )

            if b.id in self._notified_deletions:
                logger.debug("Skip duplicate cancellation for booking %s", b.id)
            elif is_series and b.recurrence_group_id in self._cancelled_groups:
                logger.debug(
                    "Skip series sibling cancellation %s (group %s already)",
                    b.id, b.recurrence_group_id,
                )
                self._notified_deletions.add(b.id)
            else:
                owner_text = msg_deleted_booking(b, self._tz)
                guest_text = msg_deleted_booking_guest(b, self._tz)
                group_text = msg_deleted_booking_group(b, self._tz)
                await self._notify_owner(b, owner_text)
                await self._notify_guests(b, guest_text)
                await self._notify_group(b, group_text)
                self._notified_deletions.add(b.id)
                if is_series and b.recurrence_group_id is not None:
                    self._cancelled_groups.add(b.recurrence_group_id)

            if b.updated_at > self._cursor_deleted:
                self._cursor_deleted = b.updated_at

    async def _notify_owner(self, b: BookingBotInfo, text: str) -> None:
        if b.user.telegram_id is None:
            return
        try:
            await self._bot.send_message(b.user.telegram_id, text)
        except Exception:  # noqa: BLE001
            logger.exception("send_message to owner %s failed", b.user.telegram_id)

    async def _notify_group(self, b: BookingBotInfo, text: str) -> None:
        """Шлём в workspace-чат — `b.workspace_telegram_chat_id`.

        Если чат не привязан — DM owner'а одноразовое предупреждение (по
        workspace_id), и пропускаем group-уведомление для этой встречи.
        """
        chat_id = b.workspace_telegram_chat_id
        if chat_id is None:
            await self._warn_owner_no_chat(b)
            return
        try:
            await self._bot.send_message(chat_id, text)
        except Exception:  # noqa: BLE001
            logger.exception("send_message to group %s failed", chat_id)

    async def _warn_owner_no_chat(self, b: BookingBotInfo) -> None:
        """Один раз на workspace DM'им owner'у что чат не привязан."""
        if b.workspace_id is None:
            return
        if b.workspace_id in self._workspace_chat_warned:
            return
        if b.user.telegram_id is None:
            return
        self._workspace_chat_warned.add(b.workspace_id)
        try:
            await self._bot.send_message(b.user.telegram_id, msg_no_chat_warning(b))
        except Exception:  # noqa: BLE001
            logger.exception(
                "no-chat warning DM to owner %s failed", b.user.telegram_id,
            )

    async def _notify_guests(self, b: BookingBotInfo, text: str) -> None:
        for g in b.guests:
            if g.telegram_id is None:
                logger.debug(
                    "Skip guest %r — no telegram_id (unregistered or free-form text)",
                    g.name,
                )
                continue
            try:
                await self._bot.send_message(g.telegram_id, text)
            except Exception:  # noqa: BLE001
                logger.exception(
                    "send_message to guest %r (tg_id=%s) failed",
                    g.name, g.telegram_id,
                )
