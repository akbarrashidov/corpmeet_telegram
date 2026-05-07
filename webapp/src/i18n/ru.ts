export const ru = {
  // App / phases
  "app.connecting": "Подключаемся…",
  "app.opening_browser": "Открываем CorpMeet в браузере…",
  "app.error.open_via_telegram": "Откройте через Telegram",

  // Home
  "home.title": "CorpMeet",
  "home.tab.day": "День",
  "home.tab.mine": "Мои",
  "home.tab.invited": "Приглашён",
  "home.empty.today": "Сегодня встреч не запланировано.",
  "home.empty.day": "На этот день встреч нет.",
  "home.empty.mine": "У тебя нет ближайших встреч.",
  "home.empty.invited": "Тебя пока никуда не зовут.",
  "home.fab.book": "Забронировать",
  "home.profile_button": "Редактировать профиль",

  // Booking detail / card
  "booking.title": "Встреча",
  "booking.organizer_self": "(это ты)",
  "booking.description_label": "Описание",
  "booking.guest_badge": "Ты в гостях",
  "booking.cancel_button": "Отменить встречу",
  "booking.reschedule_button": "Перенести встречу",
  "booking.confirm.cancel_title": "Отменить встречу?",
  "booking.confirm.cancel_body": "«{title}» — встреча будет удалена.",
  "booking.confirm.cancel": "Отменить",
  "booking.confirm.keep": "Оставить",
  "booking.error.cancel_failed": "Не удалось отменить. Попробуй ещё.",
  "booking.error.no_slots_today": "На сегодня нет свободных слотов :(",
  "booking.error.slots_failed": "Не удалось получить занятость. Попробуй ещё.",

  // Create
  "create.title": "Новая встреча",
  "create.field.name": "Название",
  "create.field.start": "Начало",
  "create.field.end": "Конец",
  "create.guests": "Гости",
  "create.guests.placeholder": "Добавь гостя",
  "create.guests.add_manual": "+ добавить «{value}»",
  "create.guests.no_users": "Нет пользователей",
  "create.guests.loading": "Загрузка...",
  "create.position_filter.heads": "Начальники",
  "create.position_filter.pm": "PM",
  "create.position_filter.analysts": "Аналитики",
  "create.position_filter.devs": "Программисты и др.",
  "create.position_filter.designers": "Дизайнеры",
  "create.error.title_required": "Назови встречу.",
  "create.error.end_after_start": "Конец должен быть позже начала.",
  "create.error.failed": "Не удалось создать встречу. Попробуй ещё.",
  "create.submit": "Создать",

  // Reschedule
  "reschedule.title": "Перенести встречу",
  "reschedule.submit_short": "Перенести",
  "reschedule.error.failed": "Не удалось перенести. Попробуй ещё.",

  // Registration
  "register.title": "Регистрация",
  "register.subtitle": "Чтобы пользоваться CorpMeet, укажи имя, фамилию и должность.",
  "register.field.first_name": "Имя",
  "register.field.last_name": "Фамилия",
  "register.field.position": "Должность",
  "register.placeholder.first_name": "Alisher",
  "register.placeholder.last_name": "Rakhimov",
  "register.error.first_name_format": "Имя — латиница, с большой буквы (например, Alisher).",
  "register.error.last_name_format": "Фамилия — латиница, с большой буквы (например, Rakhimov).",
  "register.error.position_required": "Выбери должность.",
  "register.submit": "Зарегистрироваться",

  // Position labels (singular, used in registration & profile)
  "position.label.heads": "Начальник департамента/отдела",
  "position.label.pm": "PM",
  "position.label.analyst": "Аналитик",
  "position.label.dev": "Программист и др.",
  "position.label.designer": "Дизайнер",

  // Profile
  "profile.title": "Редактировать профиль",
  "profile.position.none": "Не указана",
  "profile.language.label": "Язык",
  "profile.language.ru": "Русский",
  "profile.language.uz": "O'zbek",
  "profile.submit": "Сохранить",
  "profile.error.failed": "Не удалось сохранить. Попробуй ещё.",

  // Common
  "common.close": "Закрыть",
  "common.back": "Назад",
  "common.remove": "Удалить",
  "common.confirm": "Подтвердить",
  "common.cancel": "Отмена",
} as const;

export type TranslationKey = keyof typeof ru;
