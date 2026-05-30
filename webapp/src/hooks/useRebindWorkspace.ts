import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, type Workspace } from "@corpmeet/design/complex";

/** Привязать или отвязать Telegram-чат от workspace.
 *
 * `POST /api/v1/workspaces/{ws_id}/rebind` body `{chat_id: int | null}`.
 * `chat_id=null` → отвязка.
 * Owner/admin.
 */
export function useRebindWorkspace(workspaceId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: number | null) => {
      if (workspaceId === null) throw new Error("No workspace");
      const res = await apiClient.post<Workspace>(
        `/api/v1/workspaces/${workspaceId}/rebind`,
        { chat_id: chatId },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", "detail", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces", "mine"] });
    },
  });
}
