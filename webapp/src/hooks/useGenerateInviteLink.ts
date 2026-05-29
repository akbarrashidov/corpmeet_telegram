import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { WorkspaceMember } from "./useWorkspaceDetail";
import { saveInviteDeepLink } from "../lib/inviteCache";

/** Сгенерировать анонимную одноразовую invite-ссылку. */
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
    onSuccess: (newMember) => {
      if (newMember?.invite_deep_link) {
        saveInviteDeepLink(newMember.id, newMember.invite_deep_link);
      }
      queryClient.invalidateQueries({ queryKey: ["workspace", "detail", workspaceId] });
    },
  });
}
