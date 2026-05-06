"""Должности пользователей CorpMeet — labels, api-values, inline-клавиатура.

API-values захардкожены: бэкенд принимает только их (валидируется в
`/api/v1/internal/users/position`). Labels отображаются в Telegram-кнопке —
часть из них отличается от api-value (например, label "Программист и др."
маппится на api-value "Программист").
"""
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

# (button label, api value)
POSITION_OPTIONS: tuple[tuple[str, str], ...] = (
    ("Начальник департамента/отдела", "Начальник департамента"),
    ("PM", "PM"),
    ("Аналитик", "Аналитик"),
    ("Программист и др.", "Программист"),
    ("Дизайнер", "Дизайнер"),
)

POSITION_API_VALUES: frozenset[str] = frozenset(
    api_value for _, api_value in POSITION_OPTIONS
)

CALLBACK_PREFIX = "position:"


def position_keyboard() -> InlineKeyboardMarkup:
    """Inline-клавиатура с 5 кнопками — по одной должности на строку."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=label,
                    callback_data=f"{CALLBACK_PREFIX}{api_value}",
                )
            ]
            for label, api_value in POSITION_OPTIONS
        ]
    )


def label_for(api_value: str) -> str | None:
    """Найти отображаемый label по api-value (для confirmation message)."""
    for label, value in POSITION_OPTIONS:
        if value == api_value:
            return label
    return None
