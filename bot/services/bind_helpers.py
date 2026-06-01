"""Shared building blocks for «привязать чат» flow + open Mini App keyboards.

Используется в:
- `bot/handlers/group_added.py` — bind-chat DM/group fallback
- `bot/handlers/start.py` — invite/ws/bind deep-link handlers
"""
from urllib.parse import urlencode

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)

from bot.config import Settings

# ── Bind-chat deep-link ──────────────────────────────────────────────────────

# Префикс deep-link параметра: t.me/<bot>?start=bind_-1001234567
BIND_DEEP_LINK_PREFIX = "bind_"

DM_GREETING_TEMPLATE = (
    "Меня добавили в чат «{group_title}».\n\n"
    "Чтобы привязать его к твоему рабочему пространству — нажми кнопку ниже."
)

DM_BUTTON_TEXT = "Привязать чат"
GROUP_FALLBACK_BUTTON_TEXT = "Открой меня в личке"


def build_bind_webapp_keyboard(settings: Settings, chat_id: int) -> InlineKeyboardMarkup:
    """WebApp-кнопка, открывающая Mini App с `?bind_chat=<chat_id>`."""
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
    """URL-кнопка для group fallback'а: открывает DM с ботом и /start bind_<chat_id>."""
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
    "Тебя добавили в рабочее пространство.\n\n"
    "Нажми кнопку ниже, чтобы открыть Mini App."
)

WS_DM_GREETING = (
    "Ты вступил в рабочее пространство по ссылке.\n\n"
    "Нажми кнопку ниже, чтобы открыть Mini App."
)

OPEN_BUTTON_TEXT = "Открыть мини-приложение"


def build_open_webapp_keyboard(settings: Settings) -> InlineKeyboardMarkup:
    """WebApp-кнопка «Открыть мини-приложение» без URL-параметров.

    Используется после consume-session в invite/ws handlers — claim уже
    сделан на бэке, в URL ничего пробрасывать не нужно.
    """
    webapp_url = str(settings.webapp_url).rstrip("/")
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(
                text=OPEN_BUTTON_TEXT, web_app=WebAppInfo(url=webapp_url),
            )]
        ]
    )
