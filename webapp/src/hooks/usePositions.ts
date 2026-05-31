import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

export interface WorkspacePosition {
  id: number;
  workspace_id: number;
  name_ru: string;
  name_uz: string;
  created_at: string;
}

/**
 * Список должностей текущего workspace.
 * `GET /api/v1/workspaces/{ws_id}/positions` отдаёт WorkspacePositionResponse[].
 * Если `wsId === null` — запрос отключён.
 */
export function usePositions(wsId: number | null) {
  return useQuery<WorkspacePosition[]>({
    queryKey: ["positions", wsId],
    queryFn: async () => {
      const res = await apiClient.get<WorkspacePosition[]>(
        `/api/v1/workspaces/${wsId}/positions`,
      );
      return res.data;
    },
    enabled: wsId !== null,
    staleTime: 60_000,
  });
}
