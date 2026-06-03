import { useMemo } from "react";
import { useBookings, type Booking } from "@corpmeet/design/complex";
import { filterByWorkspace } from "../lib/booking-filter";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";

/**
 * День: встречи на конкретную дату, отфильтрованные по активному workspace.
 *
 * Для cross-workspace сценариев (timeline в CreateBookingPage) используется
 * сырой `useBookings` напрямую — этот хук остаётся для UI, который должен
 * видеть только свой workspace (HomePage tab «сегодня»).
 */
export function useDayBookings(date: string | undefined) {
  const wsId = useCurrentWorkspaceId();
  const query = useBookings(date);
  const filtered = useMemo<Booking[] | undefined>(
    () => (query.data ? filterByWorkspace(query.data, wsId) : query.data),
    [query.data, wsId],
  );
  return { ...query, data: filtered };
}
