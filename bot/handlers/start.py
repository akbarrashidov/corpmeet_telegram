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


async def _has_access(bot: Bot, settings: Settings, user_id: int) -> bool:
    """Группа-гейт. Если GROUP_ID не задан — пускаем всех (dev/CI режим)."""
    if settings.group_id is None:
        return True
    return await is_group_member(bot, settings.group_id, user_id)


@router.message(CommandStart(deep_link=True))
async def cmd_start_deep_link(
    message: Message, command: CommandObject, bot: Bot
) -> None:
    """QR-flow: /start <session_token> binds Telegram user to a browser session."""
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
        logger.warning("consume-session failed: %s", e)
        if e.response.status_code in (404, 410):
            await message.answer(
                "Ссылка истекла или уже использована. Сгенерируй новую в браузере."
            )
        else:
            await message.answer("Не удалось подтвердить вход. Попробуй ещё раз.")
        return
    except Exception:  # noqa: BLE001
        logger.exception("consume-session unexpected error")
        await message.answer("Что-то сломалось при входе. Попробуй ещё раз позже.")
        return

    await message.answer("Вход подтверждён. Возвращайся в браузер — там уже всё!")


@router.message(CommandStart())
async def cmd_start(message: Message, bot: Bot) -> None:
    """Plain /start — show Mini App button (only for group members)."""
    if message.from_user is None:
        return

    settings = get_settings()

    if not await _has_access(bot, settings, message.from_user.id):
        await message.answer(DENY_MESSAGE)
        return

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Открыть CorpMeet",
                    web_app=WebAppInfo(url=str(settings.webapp_url)),
                )
            ]
        ]
    )
    await message.answer(
        "Привет! Я бот CorpMeet. Нажми кнопку, чтобы открыть приложение.",
        reply_markup=keyboard,
    )
