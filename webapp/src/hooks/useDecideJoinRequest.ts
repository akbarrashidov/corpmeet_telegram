import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

/**
 * Approve/reject pending join-заявки от юзера.
 * `PATCH /workspaces/{ws_id}/members/{mid}` body `{approve: bool}`.
 *  - true  → status становится active
 *  - false → строка удаляется (заявка отклонена)
 *
 * Доступно owner/admin (бэк проверяет). После — invalidate workspace.detail.
 */
export function useDecideJoinRequest(wsId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      approve,
    }: {
      memberId: number;
      approve: boolean;
    }) => {
      await apiClient.patch(
        `/api/v1/workspaces/${wsId}/members/${memberId}`,
        { approve },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", "detail", wsId] });
    },
  });
}
