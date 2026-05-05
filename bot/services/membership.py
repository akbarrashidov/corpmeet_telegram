"""Group-membership check via Telegram Bot API."""
import logging

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest

logger = logging.getLogger(__name__)


async def is_group_member(bot: Bot, chat_id: int, user_id: int) -> bool:
    """True if user is creator/administrator/member, or restricted with membership.

    Returns False on left/kicked statuses, on API errors (e.g. user not found,
    chat not found, bot lacks access to the chat).
    """
    try:
        m = await bot.get_chat_member(chat_id=chat_id, user_id=user_id)
    except TelegramBadRequest as e:
        logger.warning(
            "get_chat_member failed for user_id=%s chat_id=%s: %s",
            user_id,
            chat_id,
            e,
        )
        return False

    if m.status in ("creator", "administrator", "member"):
        return True
    if m.status == "restricted":
        # restricted user IS in the chat if is_member=True (just muted/limited)
        return getattr(m, "is_member", False)
    # left, kicked
    return False
