import { useBookings } from "@corpmeet/design/complex";

/**
 * День: все встречи на конкретную дату, доступные текущему юзеру.
 *
 * Тонкая обёртка над `useBookings` без клиентской фильтрации по workspace —
 * timeline должен видеть и брони других пространств, шарящих ту же комнату,
 * иначе при бронировании возможны накладки. Page-level фильтрация по
 * `room_id` остаётся на стороне страниц (см. CreateBookingPage).
 */
export function useDayBookings(date: string | undefined) {
  return useBookings(date);
}
