import { useQuery } from "@tanstack/react-query";
import { apiClient, type WorkspaceRoom } from "@corpmeet/design/complex";

/**
 * Все комнаты, к которым у юзера есть доступ во всех его workspaces
 * (включая shared из чужих пространств). Используется для резолва
 * `room_id → name` на карточках встреч и в деталях бронирования.
 *
 * Cache shared с прямым `useQuery(["rooms","mine"])` в BookingDetailPage.
 */
export function useAllMyRooms() {
  return useQuery<WorkspaceRoom[]>({
    queryKey: ["rooms", "mine"],
    queryFn: async () => {
      const res = await apiClient.get<WorkspaceRoom[]>("/api/v1/rooms");
      return res.data;
    },
    staleTime: 60_000,
  });
}

/** Резолв имени комнаты для конкретной брони с учётом workspace_id (точное матч). */
export function resolveRoomName(
  rooms: WorkspaceRoom[] | undefined,
  roomId: number | null | undefined,
  workspaceId?: number | null,
): string | null {
  if (roomId == null || !rooms) return null;
  const match = rooms.find(
    (r) =>
      r.room.id === roomId &&
      (workspaceId == null || r.workspace_id === workspaceId),
  );
  return match?.room.name ?? null;
}
