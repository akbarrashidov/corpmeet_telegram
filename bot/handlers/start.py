"""/start handler — opens Mini App; supports QR auth + bind/invite/ws deep-links."""
import logging
from typing import Optional

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
    INVITE_DEEP_LINK_PREFIX,
    INVITE_DM_GREETING,
    WS_DEEP_LINK_PREFIX,
    WS_DM_GREETING,
    build_bind_webapp_keyboard,
    build_open_webapp_keyboard,
)

logger = logging.getLogger(__name__)
router = Router()

WELCOME_MESSAGE = "Привет! Я бот CorpMeetDev. Нажми кнопку, чтобы открыть приложение!"
WELCOME_BUTTON = "Открыть CorpMeet"
SESSION_OK_MESSAGE = "Вход подтверждён. Возвращайся в браузер — там уже всё!"


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
    """Юзер пришёл из group fallback-кнопки: `/start bind_<chat_id>`."""
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


async def _consume_invite_or_ws(
    settings: Settings, full_token: str, telegram_id: int,
) -> Optional[str]:
    """Вызывает /internal/auth/consume-session с invite_/ws_ префиксом.

    Backend сам создаёт юзера (если нет), делает claim/join и возвращает
    {ok: true}. Возвращает None при успехе, человекочитаемый текст ошибки
    при сбое.
    """
    try:
        async with ApiClient(settings) as api:
            await api.consume_session(token=full_token, telegram_id=telegram_id)
        return None
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        logger.warning(
            "consume-session failed (%s) for token %s",
            status, full_token,
        )
        if status == 410:
            return "Эта ссылка уже использована."
        if status == 404:
            return "Ссылка недействительна — возможно, она была отозвана."
        if 400 <= status < 500:
            return "Не удалось обработать ссылку. Возможно, она истекла или была отозвана."
        return "Сервер временно недоступен. Попробуй через минуту."
    except Exception:  # noqa: BLE001
        logger.exception("consume-session unexpected error for %s", full_token)
        return "Сервер временно недоступен. Попробуй через минуту."


async def _handle_invite_deep_link(
    message: Message, settings: Settings, raw_token: str,
) -> None:
    """`/start invite_<TOKEN>` — claim invite через consume-session.

    Backend по префиксу invite_ создаёт юзера если нужно, помечает member
    active, и возвращает 200. Mini App потом откроется без URL-параметров
    и сам увидит новый workspace.
    """
    if not raw_token or message.from_user is None:
        await _send_welcome(message, settings)
        return
    full_token = f"{INVITE_DEEP_LINK_PREFIX}{raw_token}"
    error_text = await _consume_invite_or_ws(
        settings, full_token, message.from_user.id,
    )
    keyboard = build_open_webapp_keyboard(settings)
    if error_text:
        await message.answer(error_text, reply_markup=keyboard)
        return
    await message.answer(INVITE_DM_GREETING, reply_markup=keyboard)


async def _handle_ws_deep_link(
    message: Message, settings: Settings, raw_code: str,
) -> None:
    """`/start ws_<CODE>` — join workspace через consume-session."""
    if not raw_code or message.from_user is None:
        await _send_welcome(message, settings)
        return
    full_token = f"{WS_DEEP_LINK_PREFIX}{raw_code}"
    error_text = await _consume_invite_or_ws(
        settings, full_token, message.from_user.id,
    )
    keyboard = build_open_webapp_keyboard(settings)
    if error_text:
        await message.answer(error_text, reply_markup=keyboard)
        return
    await message.answer(WS_DM_GREETING, reply_markup=keyboard)


@router.message(CommandStart(deep_link=True))
async def cmd_start_deep_link(
    message: Message, command: CommandObject, bot: Bot
) -> None:
    """Поддерживает четыре формата deep-link:
    - `bind_<chat_id>` → WebApp кнопка для привязки группы
    - `invite_<TOKEN>` → consume-session + WebApp кнопка
    - `ws_<CODE>` → consume-session + WebApp кнопка
    - `<token>` (произвольный) → QR-сессия для browser auth
    """
    token = (command.args or "").strip()
    if not token or message.from_user is None:
        return

    settings = get_settings()

    if token.startswith(BIND_DEEP_LINK_PREFIX):
        await _handle_bind_deep_link(
            message, bot, settings,
            raw_chat_id=token[len(BIND_DEEP_LINK_PREFIX):],
        )
        return

    if token.startswith(INVITE_DEEP_LINK_PREFIX):
        await _handle_invite_deep_link(
            message, settings,
            raw_token=token[len(INVITE_DEEP_LINK_PREFIX):],
        )
        return

    if token.startswith(WS_DEEP_LINK_PREFIX):
        await _handle_ws_deep_link(
            message, settings,
            raw_code=token[len(WS_DEEP_LINK_PREFIX):],
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
    """Plain /start — приветствие с кнопкой Mini App."""
    if message.from_user is None:
        return

    settings = get_settings()
    await _send_welcome(message, settings)
