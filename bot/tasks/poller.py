"""Background poller — checks backend for new/changed/deleted bookings and sends notifications."""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

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


def msg_new_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    return f"📌 Новая встреча «{b.title}»\n{format_time_range(b, tz)}"


def msg_changed_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    return f"✏️ Встреча «{b.title}» перенесена\nСтало: {format_time_range(b, tz)}"


def msg_deleted_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    return f"❌ Встреча «{b.title}» отменена\n{format_time_range(b, tz)}"


def msg_reminder(b: BookingBotInfo, tz: ZoneInfo) -> str:
    return f"⏰ Через 15 минут: «{b.title}»\n{format_time_range(b, tz)}"


class Poller:
    """Owns ApiClient + asyncio task + cursors."""

    def __init__(self, bot: Bot, settings: Settings) -> None:
        self._bot = bot
        self._settings = settings
        self._tz = settings.tz
        self._api = ApiClient(settings)
        self._task: Optional[asyncio.Task] = None
        # Курсоры стартуют с now — нет бэкфила старых событий после рестарта
        now = datetime.now(timezone.utc)
        self._cursor_updated = now
        self._cursor_deleted = now

    async def start(self) -> None:
        await self._api.__aenter__()
        self._task = asyncio.create_task(self._run(), name="bot-poller")
        logger.info("Poller started (interval=%ss)", POLL_INTERVAL)

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
        bookings = await self._api.bookings_since(self._cursor_updated)
        for b in bookings:
            is_change = b.prev_start_time is not None or b.prev_end_time is not None
            text = msg_changed_booking(b, self._tz) if is_change else msg_new_booking(b, self._tz)
            await self._notify_owner(b, text)
            if b.updated_at > self._cursor_updated:
                self._cursor_updated = b.updated_at

    async def _poll_reminders(self) -> None:
        bookings = await self._api.bookings_reminders()
        for b in bookings:
            await self._notify_owner(b, msg_reminder(b, self._tz))
            try:
                await self._api.mark_reminded(b.id)
            except Exception:  # noqa: BLE001
                logger.exception("mark-reminded failed for booking %s", b.id)

    async def _poll_deletions(self) -> None:
        bookings = await self._api.bookings_deleted_since(self._cursor_deleted)
        for b in bookings:
            await self._notify_owner(b, msg_deleted_booking(b, self._tz))
            if b.updated_at > self._cursor_deleted:
                self._cursor_deleted = b.updated_at

    async def _notify_owner(self, b: BookingBotInfo, text: str) -> None:
        if b.user.telegram_id is None:
            return
        try:
            await self._bot.send_message(b.user.telegram_id, text)
        except Exception:  # noqa: BLE001
            logger.exception("send_message to %s failed", b.user.telegram_id)
