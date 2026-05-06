"""Должности пользователей CorpMeet — список + inline-клавиатура.

Whitelist синхронизирован с бэкендом (`POST /internal/users/position`,
проверено curl 2026-05-06). Label и api-value совпадают.
"""
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

POSITION_OPTIONS: tuple[str, ...] = (
    "Начальник департамента/отдела",
    "PM",
    "Аналитик",
    "Программист и др.",
    "Дизайнер",
)

POSITION_API_VALUES: frozenset[str] = frozenset(POSITION_OPTIONS)

# Telegram ограничивает callback_data 64 байтами UTF-8.
# "Начальник департамента/отдела" — 56 байт; с "p:" — 58, влезает. С "position:" — 65 ❌.
CALLBACK_PREFIX = "p:"


def position_keyboard() -> InlineKeyboardMarkup:
    """Inline-клавиатура с кнопкой на каждую должность (по строке)."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=label,
                    callback_data=f"{CALLBACK_PREFIX}{label}",
                )
            ]
            for label in POSITION_OPTIONS
        ]
    )


def label_for(api_value: str) -> str | None:
    """Identity-проверка: возвращает api_value если валиден, иначе None."""
    return api_value if api_value in POSITION_API_VALUES else None
