"""Configuration loaded from environment / .env file."""
from functools import lru_cache
from typing import Optional
from zoneinfo import ZoneInfo

from pydantic import HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All bot config values. Field names map to UPPERCASE env vars."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # игнорируем VITE_* и прочие webapp-only переменные
    )

    telegram_bot_token: str
    tg_bot_username: str = "corpmeet_dev_bot"
    bot_secret: str = ""
    backend_url: HttpUrl
    webapp_url: HttpUrl
    group_id: Optional[int] = None
    app_timezone: str = "Asia/Yekaterinburg"

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.app_timezone)


@lru_cache
def get_settings() -> Settings:
    """Cached singleton — .env читается один раз за процесс."""
    return Settings()
