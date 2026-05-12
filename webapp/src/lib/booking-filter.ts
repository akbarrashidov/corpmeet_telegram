import type { Booking, User } from "@corpmeet/design/complex";

/**
 * Полное имя пользователя в формате guests-строк: "Имя Фамилия".
 * Возвращает null если у юзера нет first_name или last_name (теоретически
 * не должно случаться после регистрации).
 */
export function userFullName(user: Pick<User, "first_name" | "last_name">): string | null {
  if (!user.first_name || !user.last_name) return null;
  return `${user.first_name} ${user.last_name}`;
}

/** Фильтр «встречи где я приглашён».
 *
 * Гости теперь хранятся как `username` (фолбэк на `display_name`, если username
 * отсутствует) — поэтому матчим по `user.username` ИЛИ по `userFullName(user)`.
 * Сравнение case-insensitive с trim'ом.
 *
 * Для серийных встреч backend может хранить `guests` только на одной occurrence
 * (parent), а sibling'и приходят с пустым массивом. Поэтому собираем
 * "эффективных гостей" по `recurrence_group_id`: если хотя бы у одной
 * occurrence группы есть guests — считаем, что вся серия имеет тех же гостей.
 */
export function filterInvited(
  bookings: Booking[],
  user: Pick<User, "first_name" | "last_name" | "username">,
): Booking[] {
  const fullName = userFullName(user)?.toLowerCase() ?? null;
  const uname = user.username?.toLowerCase() ?? null;
  if (!fullName && !uname) return [];

  const groupGuests = new Map<number, string[]>();
  for (const b of bookings) {
    if (b.recurrence_group_id !== null && b.guests.length > 0) {
      groupGuests.set(b.recurrence_group_id, b.guests);
    }
  }

  return bookings.filter((b) => {
    const ownHas = b.guests.length > 0;
    const effective = ownHas
      ? b.guests
      : b.recurrence_group_id !== null
        ? groupGuests.get(b.recurrence_group_id) ?? []
        : [];
    return effective.some((g) => {
      const s = g.trim().toLowerCase();
      return (uname !== null && s === uname) || (fullName !== null && s === fullName);
    });
  });
}

/** Фильтр «мои встречи» — где я создатель (owner).
 *
 * Defensive match: `b.user_id === user.id` ИЛИ `b.user.username === user.username`
 * (case-insensitive). Резерв по username — на случай, если useAuth в Mini App
 * возвращает id, не совпадающий с backend user_id (тот же паттерн что и для
 * filterInvited — Bug A).
 *
 * Используется как обход падающего GET /api/v1/bookings/active (HTTP 500).
 */
export function filterMine(
  bookings: Booking[],
  user: Pick<User, "id" | "username">,
): Booking[] {
  const uname = user.username?.toLowerCase() ?? null;
  return bookings.filter((b) => {
    if (b.user_id === user.id) return true;
    if (uname !== null && b.user?.username?.toLowerCase() === uname) return true;
    return false;
  });
}

/** Сортировка: по start_time ascending. */
export function sortByStart(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time));
}
