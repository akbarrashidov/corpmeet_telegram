"""Aggregate router for all message handlers."""
from aiogram import Router

from bot.handlers import group_added, start

router = Router()
router.include_router(start.router)
router.include_router(group_added.router)
