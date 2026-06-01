import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, type Workspace } from "@corpmeet/design/complex";

/** Обновить публичный `invite_code` workspace'а.
 *
 * `POST /api/v1/workspaces/{ws_id}/regenerate-code`.
 * Старая публичная ссылка `ws_<old_code>` перестаёт работать немедленно.
 * Возвращает обновлённый Workspace.
 */
export function useRegenerateInviteCode(workspaceId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (workspaceId === null) throw new Error("No workspace");
      const res = await apiClient.post<Workspace>(
        `/api/v1/workspaces/${workspaceId}/regenerate-code`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", "detail", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces", "mine"] });
    },
  });
}
