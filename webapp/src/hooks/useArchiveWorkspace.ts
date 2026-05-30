import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

/** Архивировать (soft-delete) workspace.
 *
 * `DELETE /api/v1/workspaces/{ws_id}` → 204. Owner only.
 * После архивации workspace недоступен всем участникам.
 */
export function useArchiveWorkspace(workspaceId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (workspaceId === null) throw new Error("No workspace");
      await apiClient.delete(`/api/v1/workspaces/${workspaceId}`);
      return workspaceId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", "mine"] });
      queryClient.removeQueries({ queryKey: ["workspace", "detail", workspaceId] });
    },
  });
}
