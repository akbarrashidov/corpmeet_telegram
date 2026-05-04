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

/** Фильтр «встречи где я приглашён». Нечувствителен к лишним пробелам в guests. */
export function filterInvited(bookings: Booking[], user: Pick<User, "first_name" | "last_name">): Booking[] {
  const fullName = userFullName(user);
  if (!fullName) return [];
  return bookings.filter((b) =>
    b.guests.some((g) => g.trim() === fullName)
  );
}

/** Сортировка: по start_time ascending. */
export function sortByStart(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time));
}
