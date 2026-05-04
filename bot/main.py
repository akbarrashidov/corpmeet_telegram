"""Bot entry point."""
import asyncio
import logging

from aiogram import Bot, Dispatcher

from bot.config import get_settings
from bot.handlers import router as handlers_router
from bot.tasks.poller import Poller

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    settings = get_settings()
    bot = Bot(token=settings.telegram_bot_token)
    dp = Dispatcher()
    dp.include_router(handlers_router)

    poller = Poller(bot, settings)

    async def on_startup() -> None:
        await poller.start()

    async def on_shutdown() -> None:
        await poller.stop()

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    logger.info("Bot starting (username @%s)", settings.tg_bot_username)
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
