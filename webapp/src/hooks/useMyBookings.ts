import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { Booking, User } from "@corpmeet/design/complex";
import { filterByWorkspace, filterMine, sortByStart } from "../lib/booking-filter";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";

/**
 * Встречи на ближайшие 30 дней, где текущий пользователь — owner и которые
 * принадлежат активному workspace.
 *
 * Backend GET /api/v1/bookings/active возвращает upcoming (30d) по ВСЕМ
 * workspace'ам пользователя — owner + guest вперемешку. Клиент фильтрует:
 *   1) по owner (filterMine: by id или username)
 *   2) по active workspace (filterByWorkspace)
 *
 * Делит queryKey с useInvitedBookings — один сетевой запрос на обе вкладки.
 * Переключение workspace не дёргает сеть, только повторно прогоняет select.
 */
export function useMyBookings(user: User | undefined) {
  const wsId = useCurrentWorkspaceId();
  return useQuery<Booking[]>({
    queryKey: ["bookings", "active"],
    queryFn: async () => {
      const res = await apiClient.get<Booking[]>("/api/v1/bookings/active");
      return res.data;
    },
    enabled: !!user,
    staleTime: 60_000,
    select: (bookings) =>
      user ? sortByStart(filterByWorkspace(filterMine(bookings, user), wsId)) : [],
  });
}
