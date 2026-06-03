import { useQuery } from "@tanstack/react-query";
import { apiClient, useBookings, type Booking } from "@corpmeet/design/complex";
import { todayIso } from "../lib/datetime";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";

/**
 * Брони на дату для timeline-визуализации комнат.
 *
 * Для сегодняшней даты — `/api/v1/bookings/room-status` возвращает
 * cross-workspace брони (чужие title'ы редактируются в 'Занято',
 * room_id/workspace_id сохраняются). Окно бэка [now-1h, now+24h],
 * фильтруем по конкретной дате локально.
 *
 * Для других дат — fallback на `useBookings` (только свой workspace).
 * Cross-workspace на будущие дни появится когда бэк выкатит
 * `/rooms/{id}/bookings?date=…` или расширит room-status параметром date.
 */
export function useTimelineDayBookings(date: string | undefined) {
  const wsId = useCurrentWorkspaceId();
  const isToday = date === todayIso();

  const roomStatus = useQuery<Booking[]>({
    queryKey: ["bookings", "room-status", wsId],
    queryFn: async () => {
      const res = await apiClient.get<Booking[]>(
        "/api/v1/bookings/room-status",
        { params: wsId !== null ? { workspace_id: wsId } : undefined },
      );
      return res.data;
    },
    enabled: !!date && isToday,
    staleTime: 30_000,
  });

  const fallback = useBookings(isToday ? undefined : date);

  if (isToday) {
    const filtered = (roomStatus.data ?? []).filter(
      (b) => b.start_time.startsWith(date!),
    );
    return { data: filtered, isLoading: roomStatus.isLoading };
  }
  return { data: fallback.data, isLoading: fallback.isLoading };
}
