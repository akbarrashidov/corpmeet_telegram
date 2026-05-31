import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

export interface WorkspacePosition {
  id: number;
  workspace_id: number;
  name_ru: string;
  name_uz: string;
  created_at: string;
}

export interface PositionCreateBody {
  name_ru: string;
  name_uz: string;
}

export interface PositionUpdateBody {
  name_ru?: string;
  name_uz?: string;
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

function invalidatePositionsAndWorkspace(qc: ReturnType<typeof useQueryClient>, wsId: number) {
  qc.invalidateQueries({ queryKey: ["positions", wsId] });
  qc.invalidateQueries({ queryKey: ["workspace", "detail", wsId] });
}

/** Создать должность в workspace (owner/admin). */
export function useCreatePosition(wsId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: PositionCreateBody) => {
      const res = await apiClient.post<WorkspacePosition>(
        `/api/v1/workspaces/${wsId}/positions`,
        body,
      );
      return res.data;
    },
    onSuccess: () => invalidatePositionsAndWorkspace(qc, wsId),
  });
}

/** Изменить название должности (owner/admin). */
export function useUpdatePosition(wsId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: PositionUpdateBody }) => {
      const res = await apiClient.patch<WorkspacePosition>(
        `/api/v1/workspaces/${wsId}/positions/${id}`,
        body,
      );
      return res.data;
    },
    onSuccess: () => invalidatePositionsAndWorkspace(qc, wsId),
  });
}

/** Удалить должность (owner/admin). На бэке cascade SET NULL у member.position_id. */
export function useDeletePosition(wsId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/v1/workspaces/${wsId}/positions/${id}`);
    },
    onSuccess: () => invalidatePositionsAndWorkspace(qc, wsId),
  });
}
