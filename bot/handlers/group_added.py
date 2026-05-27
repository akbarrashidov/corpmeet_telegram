"""Handler for bot being added to a group: notify inviter with bind-chat WebApp button."""
import logging

from aiogram import Bot, F, Router
from aiogram.filters import JOIN_TRANSITION, ChatMemberUpdatedFilter
from aiogram.types import ChatMemberUpdated

from bot.config import get_settings
from bot.services.bind_helpers import (
    DM_GREETING_TEMPLATE,
    build_bind_webapp_keyboard,
    build_group_fallback_keyboard,
)

logger = logging.getLogger(__name__)
router = Router()


GROUP_HELLO = (
    "👋 Привет! Я бот CorpMeet — могу слать в этот чат уведомления о встречах.\n"
    "Для привязки чата к рабочему пространству напиши тому, кто меня добавил, "
    "чтобы он проверил личку со мной."
)

GROUP_FALLBACK_HEADER_TEMPLATE = (
    "{user_mention}, я не смог написать тебе в личку. "
    "Открой кнопку ниже, чтобы привязать этот чат."
)


@router.my_chat_member(
    ChatMemberUpdatedFilter(member_status_changed=JOIN_TRANSITION),
    F.chat.type.in_({"group", "supergroup"}),
)
async def on_added_to_group(event: ChatMemberUpdated, bot: Bot) -> None:
    """Bot был добавлен в группу/supergroup. Отправляем DM пригласившему
    с WebApp-кнопкой для привязки чата к workspace.

    Если DM не доходит (юзер не /start'нул бота) — кладём в группу
    fallback-сообщение с URL-кнопкой на deep-link `t.me/<bot>?start=bind_<chat_id>`.
    Юзер тапает → попадает в DM с бот → жмёт START → бот ловит param
    и отправляет WebApp кнопку (см. handlers/start.py).
    """
    settings = get_settings()
    chat_id = event.chat.id
    group_title = event.chat.title or "групповой чат"
    inviter = event.from_user
    inviter_id = inviter.id if inviter else None

    webapp_keyboard = build_bind_webapp_keyboard(settings, chat_id)

    # 1) Личный DM пригласившему
    dm_sent = False
    if inviter_id is not None:
        try:
            await bot.send_message(
                inviter_id,
                DM_GREETING_TEMPLATE.format(group_title=group_title),
                reply_markup=webapp_keyboard,
            )
            dm_sent = True
            logger.info(
                "Bind-chat DM sent to inviter %s for chat %s", inviter_id, chat_id
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "Failed to DM inviter %s for chat %s: %s", inviter_id, chat_id, e
            )

    # 2) Сообщение в группу
    try:
        if dm_sent:
            await bot.send_message(chat_id, GROUP_HELLO)
        else:
            mention = (
                f"@{inviter.username}" if inviter and inviter.username
                else (inviter.full_name if inviter else "Кто добавил меня")
            )
            await bot.send_message(
                chat_id,
                GROUP_FALLBACK_HEADER_TEMPLATE.format(user_mention=mention),
                reply_markup=build_group_fallback_keyboard(settings, chat_id),
            )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to post hello message to group %s", chat_id)
