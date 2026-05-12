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

def format_time_range(b: BookingBotInfo, tz: ZoneInfo) -> str:
    """'<dd.mm> <hh:mm>–<hh:mm>' in the given timezone."""
    start = b.start_time.astimezone(tz)
    end = b.end_time.astimezone(tz)
    return f"{start:%d.%m} {start:%H:%M}–{end:%H:%M}"

def _description_block(b: BookingBotInfo) -> str:
    """Блок повестки. Пусто если description не задан/пуст."""
    if not b.description or not b.description.strip():
        return ""
    return f"\n\n📎 Повестка / Tavsif:\n{b.description.strip()}"

# ── Серийные встречи: форматирование паттерна повторения ─────────────────────

_DAY_LABELS_RU = ("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")
_DAY_LABELS_UZ = ("Du", "Se", "Cho", "Pa", "Ju", "Sha", "Yak")

def _format_recurrence(b: BookingBotInfo) -> tuple[str, str]:
    """Возвращает (uz, ru) описание паттерна повторения для серийной встречи."""
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

def _series_blocks_split(b: BookingBotInfo) -> tuple[str, str]:
    """Разделённый блок 🔁 для серийных встреч: (uz_part, ru_part)."""
    if b.recurrence == "none" or b.recurrence_group_id is None:
        return ("", "")
    uz, ru = _format_recurrence(b)
    if not uz and not ru:
        return ("", "")
    return (f"\n🔁 {uz}", f"\n🔁 {ru}")

def _bilingual(uz: str, ru: str) -> str:
    """Узбекский сверху, русский снизу, разделитель."""
    return f"{uz}\n———\n{ru}"

# ── Тексты для DM owner ──────────────────────────────────────────────────────

def msg_new_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    uz_series, ru_series = _series_blocks_split(b)
    uz = f"📌 Yangi uchrashuv «{b.title}»\n{time}{uz_series}"
    ru = f"📌 Новая встреча «{b.title}»\n{time}{ru_series}"
    return _bilingual(uz, ru) + _description_block(b)

def msg_changed_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    uz = f"✏️ «{b.title}» uchrashuvi ko'chirildi\nEndi: {time}"
    ru = f"✏️ Встреча «{b.title}» перенесена\nСтало: {time}"
    return _bilingual(uz, ru) + _description_block(b)

def msg_deleted_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    uz = f"❌ «{b.title}» uchrashuvi bekor qilindi\n{time}"
    ru = f"❌ Встреча «{b.title}» отменена\n{time}"
    return _bilingual(uz, ru) + _description_block(b)

def msg_reminder(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    uz = f"⏰ 15 daqiqadan keyin: «{b.title}»\n{time}"
    ru = f"⏰ Через 15 минут: «{b.title}»\n{time}"
    return _bilingual(uz, ru) + _description_block(b)

# ── Тексты для DM гостей (с именем организатора) ─────────────────────────────

def msg_new_booking_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    organizer = b.user.display_name
    uz_series, ru_series = _series_blocks_split(b)
    uz = f"📌 Yangi uchrashuv «{b.title}»\n{time}\n👤 {organizer}{uz_series}"
    ru = f"📌 Новая встреча «{b.title}»\n{time}\n👤 {organizer}{ru_series}"
    return _bilingual(uz, ru) + _description_block(b)

def msg_changed_booking_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    organizer = b.user.display_name
    uz = f"✏️ «{b.title}» uchrashuvi ko'chirildi\nEndi: {time}\n👤 {organizer}"
    ru = f"✏️ Встреча «{b.title}» перенесена\nСтало: {time}\n👤 {organizer}"
    return _bilingual(uz, ru) + _description_block(b)

def msg_deleted_booking_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    organizer = b.user.display_name
    uz = f"❌ «{b.title}» uchrashuvi bekor qilindi\n{time}\n👤 {organizer}"
    ru = f"❌ Встреча «{b.title}» отменена\n{time}\n👤 {organizer}"
    return _bilingual(uz, ru) + _description_block(b)

def msg_reminder_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    organizer = b.user.display_name
    uz = f"⏰ 15 daqiqadan keyin: «{b.title}»\n{time}\n👤 {organizer}"
    ru = f"⏰ Через 15 минут: «{b.title}»\n{time}\n👤 {organizer}"
    return _bilingual(uz, ru) + _description_block(b)

# ── Текст для уведомления organizer о том что гость отказался ────────────────

def msg_guest_declined(b: BookingBotInfo, declined: GuestInfo, tz: ZoneInfo) -> str:
    """DM owner'у: гость X больше не сможет."""
    time = format_time_range(b, tz)
    uz = (
        f"🚫 «{b.title}» — mehmon ishtirok eta olmaydi\n{time}\n"
        f"🚫 {declined.name}"
    )
    ru = (
        f"🚫 «{b.title}» — гость не сможет принять участие\n{time}\n"
        f"🚫 {declined.name}"
    )
    return _bilingual(uz, ru) + _description_block(b)

# ── Тексты для группы (с organizer и guests) ─────────────────────────────────

def _guests_line(b: BookingBotInfo) -> str:
    return ", ".join(g.name for g in b.guests)

def msg_new_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    organizer = b.user.display_name
    guests_part = f"\n👥 {_guests_line(b)}" if b.guests else ""
    uz_series, ru_series = _series_blocks_split(b)
    uz = (
        f"📌 Yangi uchrashuv «{b.title}»\n{time}\n"
        f"👤 {organizer}{guests_part}{uz_series}"
    )
    ru = (
        f"📌 Новая встреча «{b.title}»\n{time}\n"
        f"👤 {organizer}{guests_part}{ru_series}"
    )
    return _bilingual(uz, ru) + _description_block(b)

def msg_changed_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    organizer = b.user.display_name
    uz = f"✏️ «{b.title}» ko'chirildi\nEndi: {time}\n👤 {organizer}"
    ru = f"✏️ «{b.title}» перенесена\nСтало: {time}\n👤 {organizer}"
    return _bilingual(uz, ru) + _description_block(b)

def msg_deleted_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    organizer = b.user.display_name
    uz = f"❌ «{b.title}» bekor qilindi\n{time}\n👤 {organizer}"
    ru = f"❌ «{b.title}» отменена\n{time}\n👤 {organizer}"
    return _bilingual(uz, ru) + _description_block(b)

class Poller:
    """Owns ApiClient + asyncio task + cursors + dedup state."""

    def __init__(self, bot: Bot, settings: Settings) -> None:
        self._bot = bot
        self._settings = settings
        self._tz = settings.tz
        self._group_id = settings.group_id
        self._api = ApiClient(settings)
        self._task: Optional[asyncio.Task] = None
        now = datetime.now(timezone.utc)
        self._cursor_updated = now
        self._cursor_deleted = now
        # Локальный дедуп: backend может возвращать одну и ту же встречу повторно
        # из-за SQLAlchemy commit-trigger'а. Шлём DM только при реальных изменениях.
        self._notified_state: dict[int, tuple[datetime, datetime]] = {}
        self._notified_deletions: set[int] = set()
        # Дедуп для серийных встреч: одно уведомление на recurrence_group_id
        self._notified_groups: set[int] = set()
        self._cancelled_groups: set[int] = set()
        # Состояние гостей per-booking для детекта decline (гость удалил себя).
        # Сравниваем prev vs current guests в каждом poll'е.
        self._guests_state: dict[int, list[GuestInfo]] = {}
        # Дедуп для series decline: при отказе от серии backend получает N PATCH'ей,
        # /since вернёт N occurrence'ов с одинаковым удалённым гостем → шлём 1 DM.
        self._declined_groups: dict[int, set[str]] = {}

    async def start(self) -> None:
        await self._api.__aenter__()
        self._task = asyncio.create_task(self._run(), name="bot-poller")
        logger.info(
            "Poller started (interval=%ss, group_id=%s)",
            POLL_INTERVAL, self._group_id,
        )

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
        # Для серийных встреч backend может вернуть occurrence'ы с одинаковым
        # updated_at в недетерминированном порядке. Сортируем по start_time, чтобы
        # representative occurrence (первая по дате) попала в групповое уведомление.
        bookings = sorted(bookings, key=lambda x: (x.start_time, x.id))
        for b in bookings:
            # Detect guest decline (диф guests vs previous poll) — независимо от изменения времени.
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
                    # Sibling occurrence уже известной серии — шлём silent.
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
                await self._notify_group(group_text)
                self._notified_state[b.id] = current
                if is_series_create and b.recurrence_group_id is not None:
                    self._notified_groups.add(b.recurrence_group_id)
            elif cached != current:
                owner_text = msg_changed_booking(b, self._tz)
                guest_text = msg_changed_booking_guest(b, self._tz)
                group_text = msg_changed_booking_group(b, self._tz)
                await self._notify_owner(b, owner_text)
                await self._notify_guests(b, guest_text)
                await self._notify_group(group_text)
                self._notified_state[b.id] = current
            else:
                logger.debug(
                    "Skip duplicate notification for booking %s (no time change)",
                    b.id,
                )

            if b.updated_at > self._cursor_updated:
                self._cursor_updated = b.updated_at

    async def _detect_guest_declines(self, b: BookingBotInfo) -> None:
        """Если у booking сократился guests с прошлого poll'а — шлём DM organizer'у
        за каждого выбывшего гостя. Для серий — dedup по recurrence_group_id+username,
        чтобы при «decline series» (N PATCH'ей) organizer получил 1 DM, а не N.
        """
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
        # Та же сортировка что в _poll_updates — для детерминированной серии.
        bookings = sorted(bookings, key=lambda x: (x.start_time, x.id))
        for b in bookings:
            is_series = (
                b.recurrence != "none" and b.recurrence_group_id is not None
            )

            if b.id in self._notified_deletions:
                logger.debug(
                    "Skip duplicate cancellation for booking %s", b.id
                )
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
                await self._notify_group(group_text)
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

    async def _notify_group(self, text: str) -> None:
        if self._group_id is None:
            return
        try:
            await self._bot.send_message(self._group_id, text)
        except Exception:  # noqa: BLE001
            logger.exception("send_message to group %s failed", self._group_id)

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
