"""/start handler — opens Mini App; supports deep-link QR auth."""
import logging

import httpx
from aiogram import Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)

from bot.config import get_settings
from bot.services.api_client import ApiClient

logger = logging.getLogger(__name__)
router = Router()


@router.message(CommandStart(deep_link=True))
async def cmd_start_deep_link(message: Message, command: CommandObject) -> None:
    """QR-flow: /start <session_token> binds Telegram user to a browser session."""
    token = (command.args or "").strip()
    if not token or message.from_user is None:
        return

    settings = get_settings()
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

    await message.answer("Вход подтверждён. Возвращайся в браузер — там уже всё.")


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    """Plain /start — show Mini App button."""
    settings = get_settings()
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
