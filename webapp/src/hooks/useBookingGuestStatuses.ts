import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

export type GuestRsvpStatus = "pending" | "accepted" | "declined";

export interface GuestStatusItem {
  name: string;
  status: GuestRsvpStatus;
}

/** Polling-интервал для отображения real-time-статусов гостей.
 *
 * 20 секунд — компромисс между свежестью UI и нагрузкой на бэк.
 * react-query сам останавливает опрос при размонтировании компонента
 * и не дёргает в фоновой вкладке (по умолчанию).
 */
const REFETCH_INTERVAL_MS = 20_000;

/** Статусы RSVP гостей конкретной встречи (включая pending для тех, кто не ответил). */
export function useBookingGuestStatuses(bookingId: number | null) {
  return useQuery<GuestStatusItem[]>({
    queryKey: ["booking", "guests", bookingId],
    enabled: bookingId !== null,
    queryFn: async () => {
      const res = await apiClient.get<GuestStatusItem[]>(
        `/api/v1/bookings/${bookingId}/guests`,
      );
      // Защита от malformed/чужого response — например когда тесты мокают
      // общий apiClient.get единственным значением для всех путей.
      if (!Array.isArray(res?.data)) return [];
      return res.data.filter(
        (g): g is GuestStatusItem => typeof g?.name === "string",
      );
    },
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: 5_000,
  });
}
