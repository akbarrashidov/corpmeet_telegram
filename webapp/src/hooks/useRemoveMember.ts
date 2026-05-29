import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

/** Удалить участника / отозвать pending-инвайт.
 *
 * `DELETE /api/v1/workspaces/{ws_id}/members/{mid}`.
 * Для pending — токен погашается, ссылка перестаёт работать.
 * Для active — юзер удаляется из workspace.
 */
export function useRemoveMember(workspaceId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: number) => {
      if (workspaceId === null) throw new Error("No workspace");
      await apiClient.delete(
        `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", "detail", workspaceId] });
    },
  });
}
