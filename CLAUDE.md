# Telegram Bot + Web App

## Зона ответственности
Telegram-бот для бронирования + встроенное веб-приложение (Web App). Доступно на https://tg.corpmeet.uz

## Стек
- Бот: Python 3.12, aiogram 3
- Web App: React 18, Vite

## Структура
```
tg-bot/
├── bot/
│   ├── main.py        # Точка входа, диспетчер
│   └── ...
├── webapp/            # React-приложение для Telegram Web App
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       └── App.jsx
```

## Правила бота
- Хэндлеры — async, с фильтрами aiogram (не парсить текст вручную)
- Каждая команда должна иметь описание для /help
- Ошибки ловить через try/except с логированием
- Состояние пользователя хранить в БД, не в памяти
- Токен бота — только через переменную окружения TELEGRAM_BOT_TOKEN

## Правила Web App
- Те же что для frontend: функциональные компоненты, хуки, fetch к /api/
- Учитывать Telegram Web App SDK (window.Telegram.WebApp)
- Адаптировать под мобильный экран (Telegram открывает в панели)

## Запуск локально
```bash
# Бот
cd tg-bot
pip install -r requirements.txt
python -m bot.main

# Web App
cd tg-bot/webapp
npm install
npm run dev
```
