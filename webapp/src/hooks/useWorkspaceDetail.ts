import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { WorkspacePosition } from "./usePositions";

/** Минимальная форма WorkspaceMember под нужды Settings + GuestPicker. */
export interface WorkspaceMember {
  id: number;
  workspace_id: number;
  user_id: number | null;
  pending_username: string | null;
  role: "owner" | "admin" | "member";
  status: "active" | "pending" | "removed";
  invite_deep_link: string | null;
  user: {
    id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    display_name: string;
    position: string | null;
  } | null;
  position_id: number | null;
  position: WorkspacePosition | null;
  created_at: string;
  invite_expires_at: string | null;
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
  tg_invite_link: string | null;
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
