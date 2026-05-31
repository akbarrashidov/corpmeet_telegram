import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

/**
 * PATCH /api/v1/workspaces/{ws_id}/members/{mid} {position_id: number|null}
 *
 * Используется в двух сценариях:
 *  - admin/owner назначает должность другому участнику
 *  - юзер ставит должность себе (PATCH self разрешён бэком)
 *
 * Бэк cascade-обнуляет position_id у member'ов при удалении позиции, но
 * назначение само по себе атомарно — после ответа в `workspace.members[i].position_id`
 * актуальное значение, инвалидируем кеш detail.
 */
export function useUpdateMemberPosition(wsId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      positionId,
    }: {
      memberId: number;
      positionId: number | null;
    }) => {
      await apiClient.patch(`/api/v1/workspaces/${wsId}/members/${memberId}`, {
        position_id: positionId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", "detail", wsId] });
    },
  });
}
