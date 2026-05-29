import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import { removeInviteDeepLink } from "../lib/inviteCache";

/** Удалить участника / отозвать pending-инвайт. */
export function useRemoveMember(workspaceId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: number) => {
      if (workspaceId === null) throw new Error("No workspace");
      await apiClient.delete(
        `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      );
      return memberId;
    },
    onSuccess: (memberId) => {
      // Чистим localStorage кэш — pending больше нет, ссылка не нужна
      removeInviteDeepLink(memberId);
      queryClient.invalidateQueries({ queryKey: ["workspace", "detail", workspaceId] });
    },
  });
}
