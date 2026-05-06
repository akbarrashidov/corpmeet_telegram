"""/start handler — Mini App, group gate, position registration, deep-link QR auth."""
import logging

import httpx
from aiogram import Bot, F, Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)

from bot.config import Settings, get_settings
from bot.positions import (
    CALLBACK_PREFIX,
    POSITION_API_VALUES,
    label_for,
    position_keyboard,
)
from bot.services.api_client import ApiClient
from bot.services.membership import is_group_member

logger = logging.getLogger(__name__)
router = Router()

DENY_MESSAGE = "Кажется, тебя нет в группе с доступом к переговорке."
POSITION_PROMPT = "Выбери должность для завершения регистрации:"
WELCOME_MESSAGE = "Привет! Я бот CorpMeet. Нажми кнопку, чтобы открыть приложение."


def _mini_app_keyboard(settings: Settings) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Открыть CorpMeet",
                    web_app=WebAppInfo(url=str(settings.webapp_url)),
                )
            ]
        ]
    )


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
    """Plain /start — ensure user, prompt for position if missing, then show Mini App."""
    if message.from_user is None:
        return

    settings = get_settings()

    if not await _has_access(bot, settings, message.from_user.id):
        await message.answer(DENY_MESSAGE)
        return

    user = message.from_user
    try:
        async with ApiClient(settings) as api:
            ensure = await api.ensure_user(
                telegram_id=user.id,
                first_name=user.first_name,
                last_name=user.last_name,
                username=user.username,
            )
    except Exception:  # noqa: BLE001
        logger.exception("ensure_user failed for telegram_id=%s", user.id)
        await message.answer("Не удалось завершить регистрацию. Попробуй ещё раз позже.")
        return

    if not ensure.has_position:
        await message.answer(POSITION_PROMPT, reply_markup=position_keyboard())
        return

    await message.answer(WELCOME_MESSAGE, reply_markup=_mini_app_keyboard(settings))


@router.callback_query(F.data.startswith(CALLBACK_PREFIX))
async def on_position_chosen(callback: CallbackQuery, bot: Bot) -> None:
    """Сохранить выбранную должность и показать Mini App."""
    if callback.from_user is None or callback.data is None:
        await callback.answer()
        return

    settings = get_settings()

    if not await _has_access(bot, settings, callback.from_user.id):
        await callback.answer(DENY_MESSAGE, show_alert=True)
        return

    api_value = callback.data[len(CALLBACK_PREFIX):]
    if api_value not in POSITION_API_VALUES:
        logger.warning("unknown position callback: %r", callback.data)
        await callback.answer("Неизвестная должность.", show_alert=True)
        return

    try:
        async with ApiClient(settings) as api:
            await api.set_position(
                telegram_id=callback.from_user.id, position=api_value
            )
    except httpx.HTTPStatusError as e:
        logger.warning("set_position failed: %s", e)
        if e.response.status_code == 404:
            await callback.answer(
                "Не нашли твою запись. Нажми /start ещё раз.", show_alert=True
            )
        else:
            await callback.answer(
                "Не удалось сохранить должность. Попробуй позже.", show_alert=True
            )
        return
    except Exception:  # noqa: BLE001
        logger.exception("set_position unexpected error")
        await callback.answer(
            "Что-то сломалось. Попробуй позже.", show_alert=True
        )
        return

    label = label_for(api_value) or api_value
    confirmation = f"Должность сохранена: {label}\n\n{WELCOME_MESSAGE}"

    if callback.message is not None:
        try:
            await callback.message.edit_text(
                confirmation, reply_markup=_mini_app_keyboard(settings)
            )
        except Exception:  # noqa: BLE001
            logger.exception("edit_text after position save failed")
            await callback.message.answer(
                confirmation, reply_markup=_mini_app_keyboard(settings)
            )

    await callback.answer()
