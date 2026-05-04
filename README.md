# CorpMeet TG Bot + Mini App

Telegram-бот и его Mini App. Два независимых контейнера, общаются с backend-ом по API (`/api/v1/...`). Локальный backend поднимать не нужно — пока работаем с дев-туннелем `https://shove-thesaurus-speed.ngrok-free.dev`.

## Зависимости среды

- Python 3.12, Node 20, Docker (для прод-режима)
- ngrok — чтобы Telegram открывал Mini App в dev-разработке (Telegram требует HTTPS)
- Тестовый Telegram-бот: `@corpmeet_dev_bot` (создан через @BotFather, токен у Артёма локально)

## Структура

```
tg-bot/
├── bot/                  # aiogram 3 — Python
├── webapp/               # React + Vite — Mini App
├── docker-compose.yml    # bot + webapp, отдельные контейнеры
├── .env.example          # шаблон переменных
└── README.md
```

## Первый запуск

```bash
cp .env.example .env
# заполнить TELEGRAM_BOT_TOKEN, BOT_SECRET (согласован с backend-командой)
```

## Локальный dev (быстрая итерация, без Docker)

Терминал 1 — Mini App:
```bash
cd webapp
npm install
npm run dev   # → http://localhost:5174
```

Терминал 2 — публичный HTTPS-туннель к webapp:
```bash
ngrok http 5174
# скопировать https-URL из вывода → подставить в .env как WEBAPP_URL
# и в @BotFather → /setdomain → выбрать @corpmeet_dev_bot → вставить тот же URL
```

Терминал 3 — бот:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m bot.main
```

Открыть @corpmeet_dev_bot в Telegram → `/start` → откроется Mini App по ngrok-URL.

## Прод-режим (Docker)

```bash
docker compose up --build
```

- Бот стартует, ходит в Telegram long-polling.
- Webapp поднимается на `:5174` (статика через nginx). HTTPS обеспечивается внешним прокси (на проде — ISPmanager/nginx → tg.corpmeet.uz).

## Деплой

(будет уточнено отдельно — общий `docker-compose.yml` репо больше не используется, нужен GitHub Actions workflow конкретно для `tg-bot/`)

## Переменные окружения

| Переменная | Где используется | Пример |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | bot | `123:ABC...` |
| `TG_BOT_USERNAME` | bot (deep-links) | `corpmeet_dev_bot` |
| `BOT_SECRET` | bot → backend `X-Bot-Secret` | `change-me` |
| `BACKEND_URL` | bot (httpx base) | `https://shove-thesaurus-speed.ngrok-free.dev` |
| `WEBAPP_URL` | bot (кнопка Mini App) | `https://abc.ngrok.io` |
| `VITE_API_URL` | webapp (build-time) | `https://shove-thesaurus-speed.ngrok-free.dev` |
| `GROUP_ID` | bot (опционально) | `-1003797683622` |

## Архитектура взаимодействия

```
        Telegram                Dev-tunnel (ngrok-free.dev)
          │                              │
          │ long-polling                 │ /api/v1/*  → backend
          ▼                              │ /          → frontend (vite dev)
    ┌──────────┐    httpx                ▲
    │   bot    │ ────────────────────────┤
    └──────────┘    + ngrok-skip header  │
          │                              │
          │ WebApp button                │
          ▼                              │
    ┌──────────┐    fetch                │
    │  webapp  │ ────────────────────────┘
    └──────────┘
```
