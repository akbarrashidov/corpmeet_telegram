import { useQuery } from "@tanstack/react-query";
import { apiClient, type Booking } from "@corpmeet/design/complex";
import { filterByWorkspace } from "../lib/booking-filter";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";

/**
 * Возвращает Set ISO-дат (YYYY-MM-DD), на которые есть хотя бы одно
 * бронирование в активном workspace.
 *
 * Использует общий endpoint `/api/v1/bookings` с диапазоном.
 * Фильтрация по workspace — на клиенте, тот же сетевой запрос для всех
 * workspace'ов; переключение не дёргает API.
 */
export function useDatesWithBookings(from: string, to: string): {
  data: Set<string>;
  isLoading: boolean;
} {
  const wsId = useCurrentWorkspaceId();
  const query = useQuery({
    queryKey: ["bookings", "dates", from, to],
    queryFn: async () => {
      const res = await apiClient.get<Booking[]>("/api/v1/bookings", {
        params: { date_from: from, date_to: to },
      });
      return res.data;
    },
    staleTime: 30_000,
  });

  const data = new Set<string>();
  const bookings = query.data ? filterByWorkspace(query.data, wsId) : [];
  for (const b of bookings) {
    // start_time — ISO datetime; берём YYYY-MM-DD
    data.add(b.start_time.slice(0, 10));
  }

  return { data, isLoading: query.isLoading };
}
