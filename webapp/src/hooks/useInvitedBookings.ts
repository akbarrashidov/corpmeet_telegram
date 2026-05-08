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
      // DEBUG: убрать после проверки
      console.log("[invited-debug]", {
        total: res.data.length,
        recurring: res.data.filter((b) => b.recurrence !== "none").length,
        sample: res.data.slice(0, 3).map((b) => ({
          id: b.id,
          title: b.title,
          recurrence: b.recurrence,
          group: b.recurrence_group_id,
          guests: b.guests,
          organizer: b.user.display_name,
        })),
      });
      return res.data;
    },
