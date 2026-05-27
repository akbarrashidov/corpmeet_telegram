"""/start handler — opens Mini App; supports deep-link QR auth + chat-bind flow."""
import logging

import httpx
from aiogram import Bot, Router
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)

from bot.config import Settings, get_settings
from bot.services.api_client import ApiClient
from bot.services.bind_helpers import (
    BIND_DEEP_LINK_PREFIX,
    DM_GREETING_TEMPLATE,
    build_bind_webapp_keyboard,
)
from bot.services.membership import is_group_member

logger = logging.getLogger(__name__)
router = Router()

DENY_MESSAGE = "Кажется, тебя нет в группе с доступом к переговорке."
WELCOME_MESSAGE = "Привет! Я бот CorpMeetDev. Нажми кнопку, чтобы открыть приложение!"
WELCOME_BUTTON = "Открыть CorpMeet"
SESSION_OK_MESSAGE = "Вход подтверждён. Возвращайся в браузер — там уже всё!"


async def _has_access(bot: Bot, settings: Settings, user_id: int) -> bool:
    """Группа-гейт. Если GROUP_ID не задан — пускаем всех (dev/CI режим)."""
    if settings.group_id is None:
        return True
    return await is_group_member(bot, settings.group_id, user_id)


async def _send_welcome(message: Message, settings: Settings) -> None:
    """Стандартное приветствие с кнопкой открытия Mini App."""
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=WELCOME_BUTTON,
                    web_app=WebAppInfo(url=str(settings.webapp_url)),
                )
            ]
        ]
    )
    await message.answer(WELCOME_MESSAGE, reply_markup=keyboard)


async def _handle_bind_deep_link(
    message: Message, bot: Bot, settings: Settings, raw_chat_id: str,
) -> None:
    """Юзер пришёл из group fallback-кнопки: `/start bind_<chat_id>`.

    Шлём ему то же DM-сообщение что и в `group_added.py` при успешном DM —
    WebApp-кнопку для привязки чата. Название группы пытаемся достать через
    `bot.get_chat`; если бот не в чате / id невалидный — fallback на «групповой чат».
    """
    try:
        chat_id = int(raw_chat_id)
    except ValueError:
        logger.warning("Invalid bind deep-link chat_id: %r", raw_chat_id)
        await _send_welcome(message, settings)
        return

    try:
        chat = await bot.get_chat(chat_id)
        group_title = chat.title or "групповой чат"
    except (TelegramBadRequest, TelegramForbiddenError) as e:
        logger.info("get_chat(%s) failed (%s); using fallback title", chat_id, e)
        group_title = "групповой чат"

    keyboard = build_bind_webapp_keyboard(settings, chat_id)
    await message.answer(
        DM_GREETING_TEMPLATE.format(group_title=group_title),
        reply_markup=keyboard,
    )


@router.message(CommandStart(deep_link=True))
async def cmd_start_deep_link(
    message: Message, command: CommandObject, bot: Bot
) -> None:
    """Поддерживает два формата deep-link:
    - `bind_<chat_id>` → отправить WebApp кнопку для привязки группы
    - `<token>` (произвольный) → QR-сессия для browser auth

    Если token не валидный (404/410/другая ошибка) — не ломаем UX
    error-сообщением: показываем обычное приветствие с кнопкой Mini App.
    """
    token = (command.args or "").strip()
    if not token or message.from_user is None:
        return

    settings = get_settings()

    if not await _has_access(bot, settings, message.from_user.id):
        await message.answer(DENY_MESSAGE)
        return

    # Bind-chat deep-link имеет приоритет над QR-сессией
    if token.startswith(BIND_DEEP_LINK_PREFIX):
        await _handle_bind_deep_link(
            message, bot, settings,
            raw_chat_id=token[len(BIND_DEEP_LINK_PREFIX):],
        )
        return

    # QR-flow: /start <session_token> — consume browser session
    try:
        async with ApiClient(settings) as api:
            await api.consume_session(token=token, telegram_id=message.from_user.id)
    except httpx.HTTPStatusError as e:
        logger.warning(
            "consume-session failed (%s); falling back to welcome",
            e.response.status_code,
        )
        await _send_welcome(message, settings)
        return
    except Exception:  # noqa: BLE001
        logger.exception("consume-session unexpected error; falling back to welcome")
        await _send_welcome(message, settings)
        return

    await message.answer(SESSION_OK_MESSAGE)


@router.message(CommandStart())
async def cmd_start(message: Message, bot: Bot) -> None:
    """Plain /start — show Mini App button (only for group members)."""
    if message.from_user is None:
        return

    settings = get_settings()

    if not await _has_access(bot, settings, message.from_user.id):
        await message.answer(DENY_MESSAGE)
        return

    await _send_welcome(message, settings)
