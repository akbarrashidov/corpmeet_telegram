import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";
import type { WorkspaceMember } from "./useWorkspaceDetail";
import { saveInviteDeepLink } from "../lib/inviteCache";

/** Пригласить пользователя по @username. */
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
    onSuccess: (newMember) => {
      if (newMember?.invite_deep_link) {
        saveInviteDeepLink(newMember.id, newMember.invite_deep_link);
      }
      queryClient.invalidateQueries({ queryKey: ["workspace", "detail", workspaceId] });
    },
  });
}
