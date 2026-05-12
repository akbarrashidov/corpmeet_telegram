import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { Booking, User } from "@corpmeet/design/complex";
import { filterMine, sortByStart } from "../lib/booking-filter";

/**
 * Встречи на ближайшие 30 дней, где текущий пользователь — owner.
 * Backend GET /api/v1/bookings/active возвращает upcoming (30d) — owner + guest
 * вперемешку. Клиент фильтрует по owner.
 *
 * Делит queryKey с useInvitedBookings — один сетевой запрос на обе вкладки.
 */
export function useMyBookings(user: User | undefined) {
  return useQuery<Booking[]>({
    queryKey: ["bookings", "active"],
    queryFn: async () => {
      const res = await apiClient.get<Booking[]>("/api/v1/bookings/active");
      return res.data;
    },
    enabled: !!user,
    staleTime: 60_000,
    select: (bookings) =>
      user ? sortByStart(filterMine(bookings, user)) : [],
  });
}
