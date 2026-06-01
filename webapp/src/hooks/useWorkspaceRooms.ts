import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { WorkspaceRoom } from "@corpmeet/design/complex";
import { filterActiveRoomsInWorkspace, sortRoomsByName } from "../lib/room-filter";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";

/**
 * Активные (не архивированные) комнаты текущего workspace.
 *
 * `GET /api/v1/rooms` отдаёт все WorkspaceRoom-биндинги пользователя по всем
 * workspace'ам — фильтруем на клиенте по current ws + `archived_at === null`.
 * Сетевой запрос один, переключение workspace только пересчитывает select.
 */
export function useWorkspaceRooms() {
  const wsId = useCurrentWorkspaceId();
  return useQuery<WorkspaceRoom[]>({
    queryKey: ["rooms", "mine"],
    queryFn: async () => {
      const res = await apiClient.get<WorkspaceRoom[]>("/api/v1/rooms");
      return res.data;
    },
    staleTime: 60_000,
    select: (rooms) => sortRoomsByName(filterActiveRoomsInWorkspace(rooms, wsId)),
  });
}
