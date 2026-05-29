import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { WorkspaceMember } from "./useWorkspaceDetail";

/** Сгенерировать **анонимную** одноразовую invite-ссылку.
 *
 * `POST /api/v1/workspaces/{ws_id}/generate-invite-link` (без body).
 * Бэк создаёт pending_member с `user: null` (анонимный) и `invite_token`.
 * Любой, кто кликнет по ссылке, привяжется к workspace через `/claim`.
 */
export function useGenerateInviteLink(workspaceId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (workspaceId === null) throw new Error("No workspace");
      const res = await apiClient.post<WorkspaceMember>(
        `/api/v1/workspaces/${workspaceId}/generate-invite-link`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", "detail", workspaceId] });
    },
  });
}
