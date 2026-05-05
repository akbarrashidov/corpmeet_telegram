"""Tests for bot.services.api_client."""
import datetime as dt
import json

import httpx
import pytest
import respx

from bot.config import Settings
from bot.services.api_client import ApiClient


def make_settings(**overrides) -> Settings:
    """Settings with sensible defaults — used to bypass env loading."""
    defaults = dict(
        telegram_bot_token="test-token-123:abc",
        backend_url="https://api.example.com",
        webapp_url="https://webapp.example.com",
        bot_secret="secret-xyz",
    )
    return Settings(**{**defaults, **overrides})


def sample_booking(**overrides) -> dict:
    base = {
        "id": 7,
        "title": "Test meeting",
        "description": None,
        "start_time": "2026-05-01T10:00:00+00:00",
        "end_time": "2026-05-01T11:00:00+00:00",
        "prev_start_time": None,
        "prev_end_time": None,
        "guests": ["alice", "bob"],
        "reminder_sent": False,
        "created_at": "2026-04-30T08:00:00+00:00",
        "updated_at": "2026-04-30T08:30:00+00:00",
        "user": {
            "id": 42,
            "telegram_id": 999,
            "username": "tester",
            "display_name": "Test User",
        },
    }
    base.update(overrides)
    return base


# ---------- consume_session (unchanged from B.1) ----------

async def test_sends_ngrok_skip_header() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        route = router.post("/api/v1/internal/auth/consume-session").respond(
            json={"ok": True}
        )

        async with ApiClient(make_settings()) as api:
            await api.consume_session(token="t1", telegram_id=42)

        sent = route.calls.last.request
        assert sent.headers.get("ngrok-skip-browser-warning") == "true"


async def test_consume_session_sends_bot_secret_and_payload() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        route = router.post("/api/v1/internal/auth/consume-session").respond(
            json={"ok": True}
        )

        async with ApiClient(make_settings()) as api:
            result = await api.consume_session(token="t1", telegram_id=42)

        assert result == {"ok": True}
        sent = route.calls.last.request
        assert sent.headers.get("X-Bot-Secret") == "secret-xyz"

        body = json.loads(sent.content)
        assert body == {"token": "t1", "telegram_id": 42}


async def test_consume_session_raises_on_4xx() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        router.post("/api/v1/internal/auth/consume-session").respond(
            status_code=410, json={"detail": "session expired"}
        )

        async with ApiClient(make_settings()) as api:
            with pytest.raises(httpx.HTTPStatusError):
                await api.consume_session(token="expired", telegram_id=42)


async def test_client_outside_context_raises() -> None:
    api = ApiClient(make_settings())
    with pytest.raises(RuntimeError):
        _ = api.client


# ---------- bookings_since ----------

async def test_bookings_since_sends_iso_datetime_and_secret() -> None:
    cursor = dt.datetime(2026, 4, 1, 12, 0, tzinfo=dt.timezone.utc)
    with respx.mock(base_url="https://api.example.com") as router:
        route = router.get("/api/v1/internal/bookings/since").respond(json=[])

        async with ApiClient(make_settings()) as api:
            result = await api.bookings_since(cursor)

        assert result == []
        sent = route.calls.last.request
        assert "updated_at=" in str(sent.url)
        assert "2026-04-01T12" in str(sent.url)
        assert sent.headers.get("X-Bot-Secret") == "secret-xyz"


async def test_bookings_since_parses_response() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        router.get("/api/v1/internal/bookings/since").respond(json=[sample_booking()])

        async with ApiClient(make_settings()) as api:
            result = await api.bookings_since(dt.datetime.now(dt.timezone.utc))

        assert len(result) == 1
        b = result[0]
        assert b.id == 7
        assert b.title == "Test meeting"
        assert b.user.telegram_id == 999
        assert b.guests == ["alice", "bob"]


# ---------- bookings_reminders ----------

async def test_bookings_reminders_no_query_params() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        route = router.get("/api/v1/internal/bookings/reminders").respond(json=[])

        async with ApiClient(make_settings()) as api:
            result = await api.bookings_reminders()

        assert result == []
        assert route.calls.last.request.headers.get("X-Bot-Secret") == "secret-xyz"
        assert "?" not in str(route.calls.last.request.url)


# ---------- mark_reminded ----------

async def test_mark_reminded_uses_path_param() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        route = router.post("/api/v1/internal/bookings/123/mark-reminded").respond(
            json={"ok": True}
        )

        async with ApiClient(make_settings()) as api:
            await api.mark_reminded(123)

        assert route.called
        assert route.calls.last.request.headers.get("X-Bot-Secret") == "secret-xyz"


# ---------- bookings_deleted_since ----------

async def test_bookings_deleted_since_uses_since_param() -> None:
    cursor = dt.datetime(2026, 4, 1, 0, 0, tzinfo=dt.timezone.utc)
    with respx.mock(base_url="https://api.example.com") as router:
        route = router.get("/api/v1/internal/bookings/deleted-since").respond(json=[])

        async with ApiClient(make_settings()) as api:
            result = await api.bookings_deleted_since(cursor)

        assert result == []
        sent_url = str(route.calls.last.request.url)
        assert "since=" in sent_url
        assert "updated_at=" not in sent_url  # отдельный параметр, не путать

# ---------- get_user_telegram_id_by_username ----------

async def test_by_username_returns_telegram_id() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        route = router.get("/api/v1/internal/users/by-username/alice").respond(
            json={"telegram_id": 123456789, "display_name": "Alice"}
        )

        async with ApiClient(make_settings()) as api:
            result = await api.get_user_telegram_id_by_username("alice")

        assert result == 123456789
        assert route.calls.last.request.headers.get("X-Bot-Secret") == "secret-xyz"


async def test_by_username_strips_leading_at_sign() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        route = router.get("/api/v1/internal/users/by-username/bob").respond(
            json={"telegram_id": 42, "display_name": "Bob"}
        )

        async with ApiClient(make_settings()) as api:
            result = await api.get_user_telegram_id_by_username("@bob")

        assert result == 42
        assert route.called  # без @ в URL


async def test_by_username_returns_none_on_404() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        router.get("/api/v1/internal/users/by-username/ghost").respond(
            status_code=404, json={"detail": "User not found"}
        )

        async with ApiClient(make_settings()) as api:
            result = await api.get_user_telegram_id_by_username("ghost")

        assert result is None


async def test_by_username_raises_on_5xx() -> None:
    with respx.mock(base_url="https://api.example.com") as router:
        router.get("/api/v1/internal/users/by-username/whoever").respond(
            status_code=500, json={"detail": "boom"}
        )

        async with ApiClient(make_settings()) as api:
            with pytest.raises(httpx.HTTPStatusError):
                await api.get_user_telegram_id_by_username("whoever")
