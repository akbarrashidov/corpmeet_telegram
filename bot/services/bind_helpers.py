"""Shared building blocks for «привязать чат» flow.

Используется в двух местах:
- `bot/handlers/group_added.py` — отправляет DM пригласившему после `my_chat_member`
- `bot/handlers/start.py` — обрабатывает deep-link `t.me/<bot>?start=bind_<chat_id>`,
  когда DM из group_added не дошёл и юзер пришёл через fallback-кнопку.
"""
from urllib.parse import urlencode

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)

from bot.config import Settings

# Префикс deep-link параметра: t.me/<bot>?start=bind_-1001234567
BIND_DEEP_LINK_PREFIX = "bind_"

DM_GREETING_TEMPLATE = (
    "Меня добавили в чат «{group_title}».\n\n"
    "Чтобы привязать его к твоему рабочему пространству — нажми кнопку ниже."
)

DM_BUTTON_TEXT = "Привязать чат"

GROUP_FALLBACK_BUTTON_TEXT = "Открой меня в личке"

def build_bind_webapp_keyboard(settings: Settings, chat_id: int) -> InlineKeyboardMarkup:
    """WebApp-кнопка, открывающая Mini App с `?bind_chat=<chat_id>`.

    Используется в DM пригласившему — Mini App в DM поддерживает WebApp кнопку.
    """
    webapp_url = str(settings.webapp_url).rstrip("/")
    url = f"{webapp_url}/?{urlencode({'bind_chat': chat_id})}"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=DM_BUTTON_TEXT, web_app=WebAppInfo(url=url))]
        ]
    )

def build_group_fallback_keyboard(
    settings: Settings, chat_id: int,
) -> InlineKeyboardMarkup:
    """URL-кнопка для group fallback'а: открывает DM с ботом и /start bind_<chat_id>.

    WebApp кнопки в group context работают не везде, поэтому используем
    обычную URL-кнопку с t.me deep-link. После тапа юзер попадает в DM,
    жмёт START, бот ловит `bind_<chat_id>` и шлёт WebApp кнопку.
    """
    deep_link = (
        f"https://t.me/{settings.tg_bot_username}"
        f"?start={BIND_DEEP_LINK_PREFIX}{chat_id}"
    )
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=GROUP_FALLBACK_BUTTON_TEXT, url=deep_link)]
        ]
    )



# ── Invite & public workspace deep-links ─────────────────────────────────────

INVITE_DEEP_LINK_PREFIX = "invite_"
WS_DEEP_LINK_PREFIX = "ws_"

INVITE_DM_GREETING = (
    "Тебя приглашают в рабочее пространство.\n\n"
    "Нажми кнопку ниже, чтобы открыть Mini App — там автоматически "
    "подтвердишь приглашение."
)

WS_DM_GREETING = (
    "Открываем рабочее пространство по ссылке.\n\n"
    "Нажми кнопку ниже — Mini App сразу добавит тебя в него."
)


def build_invite_webapp_keyboard(settings: Settings, invite_token: str) -> InlineKeyboardMarkup:
    """WebApp кнопка, открывающая Mini App с `?invite_token=<TOKEN>`.

    Mini App при загрузке парсит query, сохраняет токен и подключает
    юзера к workspace при login/register (см. BOT_INVITE_DOCS.md).
    """
    webapp_url = str(settings.webapp_url).rstrip("/")
    url = f"{webapp_url}/?invite_token={invite_token}"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(
                text="Открыть мини-приложение", web_app=WebAppInfo(url=url),
            )]
        ]
    )


def build_ws_webapp_keyboard(settings: Settings, ws_code: str) -> InlineKeyboardMarkup:
    """WebApp кнопка, открывающая Mini App с `?ws_code=<CODE>` (публичная ссылка)."""
    webapp_url = str(settings.webapp_url).rstrip("/")
    url = f"{webapp_url}/?ws_code={ws_code}"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(
                text="Открыть мини-приложение", web_app=WebAppInfo(url=url),
            )]
        ]
    )
