import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { Booking, User } from "@corpmeet/design/complex";
import { filterInvited, sortByStart } from "../lib/booking-filter";

/**
 * Встречи на ближайшие 30 дней, где текущий пользователь — гость.
 * Backend GET /api/v1/bookings/active возвращает upcoming (30d) — owner + guest
 * вперемешку. Клиент фильтрует по guest matching (username ИЛИ fullName).
 *
 * Делит queryKey с useMyBookings — один сетевой запрос на обе вкладки.
 */
export function useInvitedBookings(user: User | undefined) {
  return useQuery<Booking[]>({
    queryKey: ["bookings", "active"],
    queryFn: async () => {
      const res = await apiClient.get<Booking[]>("/api/v1/bookings/active");
      return res.data;
    },
    enabled: !!user,
    staleTime: 60_000,
    select: (bookings) =>
      user ? sortByStart(filterInvited(bookings, user)) : [],
  });
}
