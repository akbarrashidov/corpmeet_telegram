"""Tests for bot.positions."""
from bot.positions import (
    CALLBACK_PREFIX,
    POSITION_API_VALUES,
    POSITION_OPTIONS,
    label_for,
    position_keyboard,
)


def test_position_options_api_values_match_backend_spec() -> None:
    """API-values должны совпадать с whitelist'ом бэкенда (см. api-docs)."""
    expected = {
        "Начальник департамента",
        "PM",
        "Аналитик",
        "Программист",
        "Дизайнер",
    }
    actual = {api_value for _, api_value in POSITION_OPTIONS}
    assert actual == expected


def test_position_options_labels() -> None:
    """Display-labels — то что юзер видит в Telegram."""
    expected = [
        "Начальник департамента/отдела",
        "PM",
        "Аналитик",
        "Программист и др.",
        "Дизайнер",
    ]
    actual = [label for label, _ in POSITION_OPTIONS]
    assert actual == expected


def test_position_api_values_frozenset_matches_options() -> None:
    assert POSITION_API_VALUES == {api_value for _, api_value in POSITION_OPTIONS}


def test_position_keyboard_one_button_per_option_one_per_row() -> None:
    kb = position_keyboard()
    assert len(kb.inline_keyboard) == len(POSITION_OPTIONS)
    for row in kb.inline_keyboard:
        assert len(row) == 1


def test_position_keyboard_button_text_and_callback() -> None:
    kb = position_keyboard()
    for (label, api_value), row in zip(POSITION_OPTIONS, kb.inline_keyboard):
        button = row[0]
        assert button.text == label
        assert button.callback_data == f"{CALLBACK_PREFIX}{api_value}"


def test_label_for_known_api_value_returns_label() -> None:
    assert label_for("Программист") == "Программист и др."
    assert label_for("PM") == "PM"
    assert label_for("Начальник департамента") == "Начальник департамента/отдела"


def test_label_for_unknown_returns_none() -> None:
    assert label_for("Маркетолог") is None
    assert label_for("") is None


def test_callback_data_within_telegram_limit() -> None:
    """Telegram ограничивает callback_data 64 байтами (UTF-8)."""
    for _, api_value in POSITION_OPTIONS:
        cb = f"{CALLBACK_PREFIX}{api_value}"
        assert len(cb.encode("utf-8")) <= 64, f"too long: {cb}"
