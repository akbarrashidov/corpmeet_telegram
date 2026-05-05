"""Tests for bot.services.membership."""
from unittest.mock import AsyncMock, MagicMock

from aiogram.exceptions import TelegramBadRequest

from bot.services.membership import is_group_member


def make_chat_member(status: str, is_member: bool | None = None) -> MagicMock:
    m = MagicMock()
    m.status = status
    if is_member is not None:
        m.is_member = is_member
    return m


def make_bot(return_value=None, side_effect=None) -> MagicMock:
    bot = MagicMock()
    bot.get_chat_member = AsyncMock(
        return_value=return_value, side_effect=side_effect
    )
    return bot


async def test_creator_is_member() -> None:
    bot = make_bot(return_value=make_chat_member("creator"))
    assert await is_group_member(bot, -100, 1) is True


async def test_administrator_is_member() -> None:
    bot = make_bot(return_value=make_chat_member("administrator"))
    assert await is_group_member(bot, -100, 1) is True


async def test_member_is_member() -> None:
    bot = make_bot(return_value=make_chat_member("member"))
    assert await is_group_member(bot, -100, 1) is True


async def test_left_is_not_member() -> None:
    bot = make_bot(return_value=make_chat_member("left"))
    assert await is_group_member(bot, -100, 1) is False


async def test_kicked_is_not_member() -> None:
    bot = make_bot(return_value=make_chat_member("kicked"))
    assert await is_group_member(bot, -100, 1) is False


async def test_restricted_with_membership_is_member() -> None:
    bot = make_bot(return_value=make_chat_member("restricted", is_member=True))
    assert await is_group_member(bot, -100, 1) is True


async def test_restricted_without_membership_is_not_member() -> None:
    bot = make_bot(return_value=make_chat_member("restricted", is_member=False))
    assert await is_group_member(bot, -100, 1) is False


async def test_telegram_bad_request_returns_false() -> None:
    err = TelegramBadRequest(method=MagicMock(), message="user not found")
    bot = make_bot(side_effect=err)
    assert await is_group_member(bot, -100, 1) is False
