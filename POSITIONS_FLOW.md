# Workspace Positions — флоу

Должности (positions) в CorpMeet живут **на уровне workspace**. Каждый workspace ведёт свой набор должностей, каждый участник может иметь одну должность в этом workspace.

## Действия по ролям

| Действие | Кто | Где |
|---|---|---|
| **Создать набор должностей в workspace** | owner / admin | Settings → вкладка «Должности» → «+ Добавить» (RU + UZ названия) |
| **Редактировать должность** | owner / admin | Settings → Должности → ✏️ на строке |
| **Удалить должность** | owner / admin | Settings → Должности → ✕ → confirm с count'ом сколько участников затронуто. Cascade SET NULL у `member.position_id` |
| **Назначить должность другому участнику** | owner / admin | Settings → Участники → inline `<select>` под каждым members'ом. Изменение → сразу PATCH (без save-кнопки) |
| **Назначить должность себе** | любой member | ProfileScreen (👤 в шапке HomePage) → секция «Должность в "<ws>"» → дропдаун + Сохранить |
| **Снять должность** | в своей зоне | Тот же select → опция «—» |

## Где юзер увидит должность

- **HomePage**: жёлтый баннер «⚠️ У вас не указана должность» если у текущего юзера `position_id=null` в активном workspace (и в нём есть хоть одна должность). Тап «Указать» → ProfileScreen.
- **Settings → Участники**: должность отображается под именем участника.
  - Owner/admin видит inline `<select>` для смены.
  - Member видит read-only текст.
- **GuestPicker** при создании встречи: чипы `+ PM`, `+ Аналитик` по списку должностей текущего workspace. Тап → все юзеры с этой должностью добавляются в гости одним действием.

## Локализация

В шапке Mini App тоггл RU/UZ. В зависимости от выбранного языка отображается:
- `position.name_ru` для RU
- `position.name_uz` для UZ

## Где хранится в БД

| Таблица | Поля | Назначение |
|---|---|---|
| `workspace_positions` | `id, workspace_id, name_ru, name_uz, created_at` | Справочник должностей конкретного workspace |
| `workspace_members` | `position_id` (FK → workspace_positions) | Связь юзера с должностью в конкретном workspace |
| `users` (legacy) | `position: string` | **Не пишется и не читается** новым кодом. Оставлено для backward compat. |

Один юзер может иметь **разные должности** в разных workspace'ах — записи в `workspace_members` независимы.

## Бэкенд endpoints

| Endpoint | Доступ | Назначение |
|---|---|---|
| `GET /api/v1/workspaces/{ws_id}/positions` | любой member ws | Список должностей workspace |
| `POST /api/v1/workspaces/{ws_id}/positions` | owner / admin | Создать должность. Body: `{name_ru, name_uz}` |
| `PATCH /api/v1/workspaces/{ws_id}/positions/{pos_id}` | owner / admin | Обновить должность. Body: `{name_ru?, name_uz?}` |
| `DELETE /api/v1/workspaces/{ws_id}/positions/{pos_id}` | owner / admin | Удалить должность. Cascade SET NULL для всех `member.position_id` |
| `PATCH /api/v1/workspaces/{ws_id}/members/{mid}` | owner/admin → кому угодно, member → только себе | Body `{position_id: int | null}` — назначить или снять должность |

## Frontend компоненты

| Компонент | Назначение |
|---|---|
| `usePositions(wsId)` (`hooks/usePositions.ts`) | Хук для списка должностей + мутации create/update/delete |
| `useUpdateMemberPosition(wsId)` (`hooks/useUpdateMemberPosition.ts`) | Мутация назначения position_id участнику |
| `PositionPicker` (`components/PositionPicker.tsx`) | Универсальный нативный `<select>` с опцией «—» (clear). Используется и в ProfileScreen, и в MemberListRow |
| `PositionsSection` (`components/PositionsSection.tsx`) | UI вкладки «Должности» в Settings — CRUD |
| `PositionWarningBanner` (`components/PositionWarningBanner.tsx`) | Жёлтый баннер на HomePage |
| `getPositionLabel(position, lang)` (`lib/positionLabel.ts`) | Утилита локализации |

## Что НЕ делаем

- **Не пишем в `users.position`** ни на одном пути (legacy, замёрз).
- **Не предлагаем выбор должности в RegistrationScreen** — там только имя/фамилия. Должность ставится потом в первом workspace.
- **Не дублируем nudge о незаполненной должности в боте** — Mini App покрывает баннером.
