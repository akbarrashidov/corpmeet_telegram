"""Tests for bot.positions."""
from bot.positions import (
    CALLBACK_PREFIX,
    POSITION_API_VALUES,
    POSITION_OPTIONS,
    label_for,
    position_keyboard,
)


def test_position_options_match_backend_whitelist() -> None:
    """Verified by curl 2026-05-06 against POST /internal/users/position."""
    expected = {
        "Начальник департамента/отдела",
        "PM",
        "Аналитик",
        "Программист и др.",
        "Дизайнер",
    }
    assert set(POSITION_OPTIONS) == expected


def test_position_api_values_frozenset_matches_options() -> None:
    assert POSITION_API_VALUES == set(POSITION_OPTIONS)


def test_position_keyboard_one_button_per_option_one_per_row() -> None:
    kb = position_keyboard()
    assert len(kb.inline_keyboard) == len(POSITION_OPTIONS)
    for row in kb.inline_keyboard:
        assert len(row) == 1


def test_position_keyboard_button_text_and_callback() -> None:
    kb = position_keyboard()
    for label, row in zip(POSITION_OPTIONS, kb.inline_keyboard):
        button = row[0]
        assert button.text == label
        assert button.callback_data == f"{CALLBACK_PREFIX}{label}"


def test_label_for_known_value_returns_value() -> None:
    assert label_for("PM") == "PM"
    assert label_for("Программист и др.") == "Программист и др."
    assert label_for("Начальник департамента/отдела") == "Начальник департамента/отдела"


def test_label_for_unknown_returns_none() -> None:
    assert label_for("Маркетолог") is None
    assert label_for("") is None
    # Старое значение из устаревших api-docs
    assert label_for("Программист") is None


def test_callback_data_within_telegram_limit() -> None:
    """Telegram caps callback_data at 64 UTF-8 bytes."""
    for label in POSITION_OPTIONS:
        cb = f"{CALLBACK_PREFIX}{label}"
        assert len(cb.encode("utf-8")) <= 64, f"too long ({len(cb.encode('utf-8'))} bytes): {cb}"


def test_callback_prefix_short_enough_for_longest_label() -> None:
    longest = max(POSITION_OPTIONS, key=lambda x: len(x.encode("utf-8")))
    assert len((CALLBACK_PREFIX + longest).encode("utf-8")) <= 64
