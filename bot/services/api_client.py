"""HTTP client to backend API."""
from datetime import datetime
from typing import Any, Optional

import httpx
from pydantic import BaseModel, Field

from bot.config import Settings

class UserBotInfo(BaseModel):
    """Минимальная инфа о пользователе для контекста бота."""

    id: int
    telegram_id: Optional[int] = None
    username: Optional[str] = None
    display_name: str

class GuestInfo(BaseModel):
    """Гость встречи. Backend сам резолвит имя в telegram_id."""

    name: str
    telegram_id: Optional[int] = None

class BookingBotInfo(BaseModel):
    """Минимальная инфа о бронировании для уведомлений."""

    id: int
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    prev_start_time: Optional[datetime] = None
    prev_end_time: Optional[datetime] = None
    guests: list[GuestInfo] = Field(default_factory=list)
    reminder_sent: bool
    created_at: datetime
    updated_at: datetime
    user: UserBotInfo

class ApiClient:
    """Async client to backend API.

    Все запросы шлют ngrok-skip-browser-warning.
    Методы под /api/v1/internal/* дополнительно шлют X-Bot-Secret.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "ApiClient":
        self._client = httpx.AsyncClient(
            base_url=str(self._settings.backend_url).rstrip("/"),
            headers={
                "ngrok-skip-browser-warning": "true",
                "User-Agent": "corpmeet-bot/0.1",
            },
            timeout=httpx.Timeout(10.0),
        )
        return self

    async def __aexit__(self, *_exc) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("ApiClient not entered — use 'async with ApiClient(...)'")
        return self._client

    def _internal_headers(self) -> dict[str, str]:
        return {"X-Bot-Secret": self._settings.bot_secret}

    async def consume_session(self, token: str, telegram_id: int) -> dict[str, Any]:
        """Bind telegram_id to a QR session token."""
        resp = await self.client.post(
            "/api/v1/internal/auth/consume-session",
            json={"token": token, "telegram_id": telegram_id},
            headers=self._internal_headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def bookings_since(self, updated_at: datetime) -> list[BookingBotInfo]:
        """Bookings with updated_at >= the given datetime."""
        resp = await self.client.get(
            "/api/v1/internal/bookings/since",
            params={"updated_at": updated_at.isoformat()},
            headers=self._internal_headers(),
        )
        resp.raise_for_status()
        return [BookingBotInfo.model_validate(item) for item in resp.json()]

    async def bookings_reminders(self) -> list[BookingBotInfo]:
        """Bookings starting in 14–16 min with reminder_sent=False."""
        resp = await self.client.get(
            "/api/v1/internal/bookings/reminders",
            headers=self._internal_headers(),
        )
        resp.raise_for_status()
        return [BookingBotInfo.model_validate(item) for item in resp.json()]

    async def mark_reminded(self, booking_id: int) -> None:
        """Mark booking as having received its reminder."""
        resp = await self.client.post(
            f"/api/v1/internal/bookings/{booking_id}/mark-reminded",
            headers=self._internal_headers(),
        )
        resp.raise_for_status()

    async def bookings_deleted_since(self, since: datetime) -> list[BookingBotInfo]:
        """Bookings deleted after the given datetime."""
        resp = await self.client.get(
            "/api/v1/internal/bookings/deleted-since",
            params={"since": since.isoformat()},
            headers=self._internal_headers(),
        )
        resp.raise_for_status()
        return [BookingBotInfo.model_validate(item) for item in resp.json()]
