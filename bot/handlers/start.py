"""/start handler — opens Mini App; supports deep-link QR auth."""
import logging

import httpx
from aiogram import Bot, Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)

from bot.config import Settings, get_settings
from bot.services.api_client import ApiClient
from bot.services.membership import is_group_member

logger = logging.getLogger(__name__)
router = Router()

DENY_MESSAGE = "Кажется, тебя нет в группе с доступом к переговорке."
WELCOME_MESSAGE = "Привет! Я бот CorpMeet. Нажми кнопку, чтобы открыть приложение."
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


@router.message(CommandStart(deep_link=True))
async def cmd_start_deep_link(
    message: Message, command: CommandObject, bot: Bot
) -> None:
    """QR-flow: /start <session_token> binds Telegram user to a browser session.

    Если token не валидный (404/410/другая ошибка) — не ломаем UX
    error-сообщением: показываем обычное приветствие с кнопкой Mini App.
    Это важно для новых пользователей, которые приходят по любой ссылке
    с произвольным аргументом.
    """
    token = (command.args or "").strip()
    if not token or message.from_user is None:
        return

    settings = get_settings()

    if not await _has_access(bot, settings, message.from_user.id):
        await message.answer(DENY_MESSAGE)
        return

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
