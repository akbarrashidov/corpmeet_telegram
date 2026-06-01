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
    return f"\n\n📝 Повестка / Tavsif:\n{b.description.strip()}"


def _attachments_block(b: BookingBotInfo) -> str:
    if not b.has_attachments:
        return ""
    return (
        "\n\n📎 К встрече прикреплён файл / Uchrashuvga fayl biriktirilgan\n"
        "→ corpmeet.uz"
    )


def _video_block(b: BookingBotInfo) -> str:
    if not b.video_enabled:
        return ""
    return f"\n🎥 {_action('Videokonferentsiya', 'Видеоконференция')}"

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


def _body_lines(
    b: BookingBotInfo,
    time_text: str,
    *,
    show_organizer: bool,
    show_series: bool,
) -> str:
    """Унифицированный body-блок: время → organizer? → room → video → guests → series?"""
    parts = [f"\n{time_text}"]
    if show_organizer:
        parts.append(_organizer_line(b))
    parts.append(_room_line(b))
    parts.append(_video_block(b))
    parts.append(_guests_line_block(b))
    if show_series:
        parts.append(_series_line(b))
    return "".join(parts)


# Owner-DM (без organizer-line — он и так знает что это его встреча)
def msg_new_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"📌 «{b.title}» — {_action('yangi uchrashuv', 'новая встреча')}"
    return head + _body_lines(
        b, format_time_range(b, tz), show_organizer=False, show_series=True,
    ) + _footer(b)


def msg_changed_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"✏️ «{b.title}» — {_action("vaqti o'zgartirildi", 'перенесена')}"
    return head + _body_lines(
        b, format_time_change(b, tz), show_organizer=False, show_series=False,
    ) + _footer(b)


def msg_deleted_booking(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"❌ «{b.title}» — {_action('bekor qilindi', 'отменена')}"
    return head + _body_lines(
        b, format_time_range(b, tz), show_organizer=False, show_series=False,
    ) + _description_block(b)


def msg_reminder(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"⏰ {_action('15 daqiqadan', 'Через 15 минут')} — «{b.title}»"
    return head + _body_lines(
        b, format_time_range(b, tz), show_organizer=False, show_series=False,
    ) + _footer(b)


# Гостевые DM — same body как у owner, но + organizer-line
def msg_new_booking_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"📌 «{b.title}» — {_action('yangi uchrashuv', 'новая встреча')}"
    return head + _body_lines(
        b, format_time_range(b, tz), show_organizer=True, show_series=True,
    ) + _footer(b)


def msg_changed_booking_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"✏️ «{b.title}» — {_action("vaqti o'zgartirildi", 'перенесена')}"
    return head + _body_lines(
        b, format_time_change(b, tz), show_organizer=True, show_series=False,
    ) + _footer(b)


def msg_deleted_booking_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"❌ «{b.title}» — {_action('bekor qilindi', 'отменена')}"
    return head + _body_lines(
        b, format_time_range(b, tz), show_organizer=True, show_series=False,
    ) + _description_block(b)


def msg_reminder_guest(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"⏰ {_action('15 daqiqadan', 'Через 15 минут')} — «{b.title}»"
    return head + _body_lines(
        b, format_time_range(b, tz), show_organizer=True, show_series=False,
    ) + _footer(b)


# Группа — то же что guest DM (тот же набор полей)
def msg_new_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"📌 «{b.title}» — {_action('yangi uchrashuv', 'новая встреча')}"
    return head + _body_lines(
        b, format_time_range(b, tz), show_organizer=True, show_series=True,
    ) + _footer(b)


def msg_changed_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"✏️ «{b.title}» — {_action("vaqti o'zgartirildi", 'перенесена')}"
    return head + _body_lines(
        b, format_time_change(b, tz), show_organizer=True, show_series=False,
    ) + _footer(b)


def msg_deleted_booking_group(b: BookingBotInfo, tz: ZoneInfo) -> str:
    head = f"❌ «{b.title}» — {_action('bekor qilindi', 'отменена')}"
    return head + _body_lines(
        b, format_time_range(b, tz), show_organizer=True, show_series=False,
    ) + _description_block(b)


# Owner-only: гость отказался
def msg_guest_declined(b: BookingBotInfo, declined: GuestInfo, tz: ZoneInfo) -> str:
    head = (
        f"🚫 «{b.title}» — "
        f"{_action('ishtirokchilar ishtirok eta olmaydi', 'гость не сможет принять участие')}"
    )
    body = f"\n{format_time_range(b, tz)}{_room_line(b)}{_video_block(b)}\n🚫 {declined.name}"
    return head + body + _description_block(b)

# Participant-only: накладка с другими его встречами
def msg_overlap_warning(
    new: BookingBotInfo, conflicts: list[BookingBotInfo], tz: ZoneInfo,
) -> str:
    uz = "quyidagi uchrashuvga to’g’ri keladi"
    ru = "накладывается на"
    head = f"⚠️ {_action('Vaqt mosligi', 'Накладка по времени')}"
    intro = f"\n\n«{new.title}» — {format_time_range(new, tz)}\n{_action(uz, ru)}:"
    bullets = "\n".join(
        f"• «{c.title}» — {format_time_range(c, tz)}" for c in conflicts
    )
    return head + intro + "\n" + bullets

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
        # Все известные upcoming bookings (для overlap-detection)
        self._active_bookings: dict[int, BookingBotInfo] = {}
        # Дедуп overlap-DM: (booking_id, participant_tg_id, start_iso, end_iso)
        # — start/end в ключе чтобы при reschedule отправлять заново
        self._notified_overlaps: set[tuple[int, int, str, str]] = set()

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
            self._active_bookings[b.id] = b
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
                await self._check_and_notify_overlaps(b)
                self._notified_state[b.id] = current
                self._active_bookings[b.id] = b
                if is_series_create and b.recurrence_group_id is not None:
                    self._notified_groups.add(b.recurrence_group_id)
            elif cached != current:
                owner_text = msg_changed_booking(b, self._tz)
                guest_text = msg_changed_booking_guest(b, self._tz)
                group_text = msg_changed_booking_group(b, self._tz)
                await self._notify_owner(b, owner_text)
                await self._notify_guests(b, guest_text)
                await self._notify_group(b, group_text)
                await self._check_and_notify_overlaps(b)
                self._notified_state[b.id] = current
                self._active_bookings[b.id] = b
            else:
                logger.debug(
                    "Skip duplicate notification for booking %s (no time change)",
                    b.id,
                )
                self._active_bookings[b.id] = b

            if b.updated_at > self._cursor_updated:
                self._cursor_updated = b.updated_at

    async def _check_and_notify_overlaps(self, new: BookingBotInfo) -> None:
        """Для каждого участника новой/изменённой встречи проверить —
        пересекается ли время с его другими активными встречами. Если да —
        DM **только** этому участнику с указанием конфликтующих встреч.

        Past bookings игнорируем. Дедуп через `_notified_overlaps`:
        ключ включает start/end, чтобы при reschedule сработать заново.
        """
        now = datetime.now(timezone.utc)
        new_start_ms = new.start_time.timestamp()
        new_end_ms = new.end_time.timestamp()

        # Собираем участников новой встречи с telegram_id.
        participants: list[int] = []
        if new.user.telegram_id is not None:
            participants.append(new.user.telegram_id)
        for g in new.guests:
            if g.telegram_id is not None and g.telegram_id not in participants:
                participants.append(g.telegram_id)

        for tg_id in participants:
            # Найти ВСЕ другие активные встречи где этот юзер участвует
            # И время пересекается с new.
            conflicts: list[BookingBotInfo] = []
            for other in self._active_bookings.values():
                if other.id == new.id:
                    continue
                if other.end_time < now:
                    continue
                user_in_other = (
                    other.user.telegram_id == tg_id
                    or any(g.telegram_id == tg_id for g in other.guests)
                )
                if not user_in_other:
                    continue
                other_start_ms = other.start_time.timestamp()
                other_end_ms = other.end_time.timestamp()
                if new_start_ms < other_end_ms and new_end_ms > other_start_ms:
                    conflicts.append(other)

            if not conflicts:
                continue

            # Дедуп — ключ включает время чтобы reschedule перевзвёл проверку.
            key = (
                new.id,
                tg_id,
                new.start_time.isoformat(),
                new.end_time.isoformat(),
            )
            if key in self._notified_overlaps:
                continue
            self._notified_overlaps.add(key)

            conflicts.sort(key=lambda c: (c.start_time, c.id))
            text = msg_overlap_warning(new, conflicts, self._tz)
            try:
                await self._bot.send_message(tg_id, text)
            except Exception:  # noqa: BLE001
                logger.exception("Overlap DM to %s failed", tg_id)

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
