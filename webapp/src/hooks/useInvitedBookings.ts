import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { Booking, User } from "@corpmeet/design/complex";
import { addDaysIso, todayIso } from "../lib/datetime";
import { filterInvited, sortByStart } from "../lib/booking-filter";

const HORIZON_DAYS = 30;

/**
 * Встречи на ближайшие 30 дней, где текущий пользователь — гость.
 * Запрос диапазона на бэк + клиентская фильтрация по guests.
 */
export function useInvitedBookings(user: User | undefined) {
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
    enabled: !!user?.first_name && !!user?.last_name,
    staleTime: 60_000,
    select: (bookings) =>
      user ? sortByStart(filterInvited(bookings, user)) : [],
  });
}
