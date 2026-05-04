"""Common pytest fixtures — environmental isolation."""
from pathlib import Path
from typing import Iterator

import pytest


@pytest.fixture(autouse=True)
def _isolated_cwd(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Run each test in an empty tmp dir so .env files don't leak in."""
    monkeypatch.chdir(tmp_path)
    yield


@pytest.fixture(autouse=True)
def _clear_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Wipe app env vars before each test."""
    for key in (
        "TELEGRAM_BOT_TOKEN",
        "TG_BOT_USERNAME",
        "BOT_SECRET",
        "BACKEND_URL",
        "WEBAPP_URL",
        "GROUP_ID",
    ):
        monkeypatch.delenv(key, raising=False)
    yield
