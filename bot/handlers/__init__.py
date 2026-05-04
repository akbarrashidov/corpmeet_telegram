"""Aggregate router for all message handlers."""
from aiogram import Router

from bot.handlers import start

router = Router()
router.include_router(start.router)
