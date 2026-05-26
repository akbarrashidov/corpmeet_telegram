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

## Режим работы Claude (manual execution mode)

В этом проекте Claude работает **только через текстовые инструкции** — никаких прямых правок и команд, меняющих состояние.

**Запрещено Claude:**
- Вызывать инструменты Edit / Write / NotebookEdit на файлы проекта (любые пути внутри `BookTheRoom/`)
- Запускать через Bash команды, меняющие состояние: `git checkout/add/commit/push/reset/rebase/merge`, `npm install/run/test`, `pnpm`, `pytest`, `vitest`, `mv`, `rm`, `sed -i`, перенаправления `>`/`>>` в файлы проекта, `docker`, и т.п.
- Создавать/удалять файлы в репозитории

**Разрешено Claude:**
- Read, grep, ls, find — для изучения кода
- Bash для read-only проверок: `git status`, `git log`, `git diff`, `git branch --show-current`, `cat`, `curl https://…/openapi.json`
- Edit/Write **только** в каталоге памяти `~/.claude/projects/.../memory/`
- WebFetch для документации

**Протокол изменений:**
1. Claude выводит в чат подробную инструкцию: полный путь + полный код блока или точный diff с контекстом + bash-команды для применения
2. Пользователь применяет сам
3. «ок» = пользователь подтвердил результат → Claude верифицирует через Read и сразу даёт следующий шаг
4. «го» = Claude переходит к следующему шагу плана без верификации
5. При нарушении правила Claude обязан немедленно откатить (выдать инструкцию `git checkout --` или удаление)

**Why:** Артём контролирует каждое изменение в репо. Прецеденты прошлых сессий, где Claude самовольно правил инфра-файлы или запускал `git reset --hard`, ломали dev-окружение коллег.


## Формат планов

CorpMeet — **не** data science проект. В планах НЕ писать:
- Секцию «Context Check» из глобального CLAUDE.md (она для SCADA/Anomaly Detection)
- Фразы «не data science задача», «не DS», «без ML-составляющей» и подобные disclaimer'ы

Структура плана для CorpMeet:
1. **Approach** — высокоуровневый разбор
2. **Files** — какие файлы трогаем
3. **Open questions** — что уточнить у Артёма перед стартом (если есть)

Никаких упоминаний DS/SCADA/sensors в любом разделе плана.
