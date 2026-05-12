import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { Booking, User } from "@corpmeet/design/complex";
import { addDaysIso, todayIso } from "../lib/datetime";
import { filterMine, sortByStart } from "../lib/booking-filter";

const HORIZON_DAYS = 30;

/**
 * Встречи на ближайшие 30 дней, где текущий пользователь — owner.
 * Обход падающего GET /api/v1/bookings/active (HTTP 500 на бэке).
 * Делит queryKey с useInvitedBookings — один сетевой запрос на обе вкладки.
 */
export function useMyBookings(user: User | undefined) {
  const from = todayIso();
  const to = addDaysIso(from, HORIZON_DAYS);

  return useQuery<Booking[]>({
    queryKey: ["bookings", "range", from, to],
    queryFn: async () => {
      const res = await apiClient.get<Booking[]>("/api/v1/bookings", {
        params: { date_from: from, date_to: to },
      });
      return res.data;
    },
    enabled: !!user,
    staleTime: 60_000,
    select: (bookings) =>
      user ? sortByStart(filterMine(bookings, user)) : [],
  });
}
