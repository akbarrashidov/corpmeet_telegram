import { useMemo } from "react";
import { useBookings, type Booking } from "@corpmeet/design/complex";
import { filterByWorkspace } from "../lib/booking-filter";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";

/**
 * День: встречи на конкретную дату, отфильтрованные по активному workspace.
 *
 * Тонкая обёртка над `useBookings` из design-package (сам пакет про workspaces
 * не знает) — фильтрация на клиенте через `filterByWorkspace`. Если wsId =
 * null, фильтр не применяется (возвращаются все).
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
