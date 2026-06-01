import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { Booking, User } from "@corpmeet/design/complex";
import { filterByWorkspace, filterInvited, sortByStart } from "../lib/booking-filter";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";

/**
 * Встречи на ближайшие 30 дней, где текущий пользователь — гость и которые
 * принадлежат активному workspace.
 *
 * Backend GET /api/v1/bookings/active возвращает upcoming (30d) — owner + guest
 * вперемешку, по всем workspace'ам. Клиент фильтрует:
 *   1) по guest matching (filterInvited: username ИЛИ fullName)
 *   2) по active workspace (filterByWorkspace)
 *
 * Делит queryKey с useMyBookings.
 */
export function useInvitedBookings(user: User | undefined) {
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
      user ? sortByStart(filterByWorkspace(filterInvited(bookings, user), wsId)) : [],
  });
}
