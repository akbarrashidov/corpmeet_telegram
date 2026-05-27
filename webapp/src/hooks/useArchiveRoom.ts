import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

/**
 * Архивация комнаты — `DELETE /api/v1/rooms/{id}` (бэк помечает archived_at,
 * запись остаётся в БД). После успеха инвалидируем `["rooms", "mine"]`,
 * чтобы списки в `useWorkspaceRooms` перестали показывать архивную.
 *
 * UX-нюанс: разрешаем архивировать даже последнюю комнату (с warning'ом
 * на стороне UI — см. RoomsSection.tsx). Бэк не запрещает.
 */
export function useArchiveRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: number) => {
      await apiClient.delete(`/api/v1/rooms/${roomId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", "mine"] });
    },
  });
}
