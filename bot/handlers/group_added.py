"""Handler for bot being added to a group: notify inviter with bind-chat WebApp button."""
import logging
from urllib.parse import urlencode

from aiogram import Bot, F, Router
from aiogram.filters import JOIN_TRANSITION, ChatMemberUpdatedFilter
from aiogram.types import (
    ChatMemberUpdated,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)

from bot.config import get_settings

logger = logging.getLogger(__name__)
router = Router()


GROUP_HELLO = (
    "👋 Привет! Я бот CorpMeet — могу слать в этот чат уведомления о встречах.\n"
    "Для привязки чата к рабочему пространству напиши тому, кто меня добавил, "
    "чтобы он проверил личку со мной."
)

DM_GREETING_TEMPLATE = (
    "Меня добавили в чат «{group_title}».\n\n"
    "Чтобы привязать его к твоему рабочему пространству — нажми кнопку ниже."
)

DM_BUTTON_TEXT = "Привязать чат"

# Fallback в группу — на случай, если ЛС с user'ом недоступна
GROUP_FALLBACK_TEMPLATE = (
    "{user_mention}, я не смог написать тебе в личку. "
    "Открой меня в боте (нажми /start), затем добавь меня в этот чат заново."
)


def _build_webapp_button(chat_id: int) -> InlineKeyboardMarkup:
    settings = get_settings()
    webapp_url = str(settings.webapp_url).rstrip("/")
    url = f"{webapp_url}/?{urlencode({'bind_chat': chat_id})}"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=DM_BUTTON_TEXT, web_app=WebAppInfo(url=url))]
        ]
    )


@router.my_chat_member(
    ChatMemberUpdatedFilter(member_status_changed=JOIN_TRANSITION),
    F.chat.type.in_({"group", "supergroup"}),
)
async def on_added_to_group(event: ChatMemberUpdated, bot: Bot) -> None:
    """Bot был добавлен в группу/supergroup. Отправляем DM пригласившему
    с WebApp-кнопкой для привязки чата к workspace."""
    chat_id = event.chat.id
    group_title = event.chat.title or "групповой чат"
    inviter = event.from_user
    inviter_id = inviter.id if inviter else None

    keyboard = _build_webapp_button(chat_id)

    # 1) Личный DM пригласившему
    dm_sent = False
    if inviter_id is not None:
        try:
            await bot.send_message(
                inviter_id,
                DM_GREETING_TEMPLATE.format(group_title=group_title),
                reply_markup=keyboard,
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
                GROUP_FALLBACK_TEMPLATE.format(user_mention=mention),
            )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to post hello message to group %s", chat_id)
