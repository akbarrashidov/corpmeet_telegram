import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

/** Минимальная форма WorkspaceMember под нужды Settings.
 * Полная схема — `WorkspaceMemberResponse` в Swagger; добавим поля по мере
 * необходимости в PR-4. Пока только то, что нужно показать в списке участников.
 */
export interface WorkspaceMember {
  id: number;
  workspace_id: number;
  user_id: number | null;
  pending_username: string | null;
  role: "owner" | "admin" | "member";
  status: "active" | "pending" | "removed";
  user: {
    id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    display_name: string;
    position: string | null;
  } | null;
  created_at: string;
}

export interface WorkspaceDetail {
  id: number;
  name: string;
  slug: string;
  invite_code: string;
  timezone: string;
  telegram_chat_id: number | null;
  created_at: string;
  my_role: "owner" | "admin" | "member" | null;
  members: WorkspaceMember[];
  pending_members: WorkspaceMember[];
}

/**
 * Детальная карточка workspace с участниками — для Settings screen.
 * `GET /api/v1/workspaces/{ws_id}` отдаёт WorkspaceDetailResponse.
 *
 * Если `wsId === null` — запрос отключён.
 */
export function useWorkspaceDetail(wsId: number | null) {
  return useQuery<WorkspaceDetail>({
    queryKey: ["workspace", "detail", wsId],
    queryFn: async () => {
      const res = await apiClient.get<WorkspaceDetail>(`/api/v1/workspaces/${wsId}`);
      return res.data;
    },
    enabled: wsId !== null,
    staleTime: 30_000,
  });
}
