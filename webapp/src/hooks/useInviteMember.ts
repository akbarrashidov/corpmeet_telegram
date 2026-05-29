import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { WorkspaceMember } from "./useWorkspaceDetail";

/** Пригласить пользователя по @username.
 *
 * `POST /api/v1/workspaces/{ws_id}/invite` body `{username}`.
 * Бэк создаёт `pending_member` + генерирует `invite_token` и `invite_deep_link`.
 * Если username не зарегистрирован — pending_username запишется, юзер появится
 * после клика по deep_link и `/start invite_TOKEN`.
 */
export function useInviteMember(workspaceId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      if (workspaceId === null) throw new Error("No workspace");
      const cleanUsername = username.startsWith("@") ? username.slice(1) : username;
      const res = await apiClient.post<WorkspaceMember>(
        `/api/v1/workspaces/${workspaceId}/invite`,
        { username: cleanUsername },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", "detail", workspaceId] });
    },
  });
}
