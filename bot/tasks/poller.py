"""Background poller — checks backend for new/changed/deleted bookings and sends notifications."""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import httpx

from aiogram import Bot

from bot.config import Settings
from bot.services.api_client import ApiClient, BookingBotInfo

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


def _bilingual(uz: str, ru: str) -> str:
    """Узбекский сверху, русский снизу, разделитель."""
    return f"{uz}\n———\n{ru}"


# ── Тексты для DM (owner / guests) ───────────────────────────────────────────


def msg_new_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    uz = f"📌 Yangi uchrashuv «{b.title}»\n{time}"
    ru = f"📌 Новая встреча «{b.title}»\n{time}"
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


# ── Тексты для группы (с organizer и guests) ─────────────────────────────────


def _guests_line(b: BookingBotInfo) -> str:
    return ", ".join(g.name for g in b.guests)


def msg_new_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    time = format_time_range(b, tz)
    organizer = b.user.display_name
    guests_part = f"\n👥 {_guests_line(b)}" if b.guests else ""
    uz = f"📌 Yangi uchrashuv «{b.title}»\n{time}\n👤 {organizer}{guests_part}"
    ru = f"📌 Новая встреча «{b.title}»\n{time}\n👤 {organizer}{guests_part}"
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
        self._notified_state: dict[int, tuple[datetime, datetime]] = {}
        self._notified_deletions: set[int] = set()

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
        for b in bookings:
            cached = self._notified_state.get(b.id)
            current = (b.start_time, b.end_time)

            if cached is None:
                is_change = b.prev_start_time is not None or b.prev_end_time is not None
                if is_change:
                    dm_text = msg_changed_booking(b, self._tz)
                    group_text = msg_changed_booking_group(b, self._tz)
                else:
                    dm_text = msg_new_booking(b, self._tz)
                    group_text = msg_new_booking_group(b, self._tz)
                await self._notify_owner(b, dm_text)
                await self._notify_guests(b, dm_text)
                await self._notify_group(group_text)
                self._notified_state[b.id] = current
            elif cached != current:
                dm_text = msg_changed_booking(b, self._tz)
                group_text = msg_changed_booking_group(b, self._tz)
                await self._notify_owner(b, dm_text)
                await self._notify_guests(b, dm_text)
                await self._notify_group(group_text)
                self._notified_state[b.id] = current
            else:
                logger.debug(
                    "Skip duplicate notification for booking %s (no time change)",
                    b.id,
                )

            if b.updated_at > self._cursor_updated:
                self._cursor_updated = b.updated_at

    async def _poll_reminders(self) -> None:
        bookings = await self._api.bookings_reminders()
        for b in bookings:
            text = msg_reminder(b, self._tz)
            await self._notify_owner(b, text)
            await self._notify_guests(b, text)
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
        for b in bookings:
            if b.id in self._notified_deletions:
                logger.debug(
                    "Skip duplicate cancellation for booking %s", b.id
                )
            else:
                dm_text = msg_deleted_booking(b, self._tz)
                group_text = msg_deleted_booking_group(b, self._tz)
                await self._notify_owner(b, dm_text)
                await self._notify_guests(b, dm_text)
                await self._notify_group(group_text)
                self._notified_deletions.add(b.id)

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
