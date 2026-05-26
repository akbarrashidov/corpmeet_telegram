import type { WorkspaceRoom } from "@corpmeet/design/complex";

/** Активные (не архивированные) комнаты текущего workspace.
 *
 * `GET /rooms` возвращает все WorkspaceRoom-биндинги по всем workspace'ам
 * юзера. Здесь делаем два фильтра:
 *  - по workspace_id (только текущий)
 *  - по archived_at (только активные)
 *
 * `workspaceId === null` → возвращаем пустой массив (юзер ещё не выбрал
 * workspace; UI до этого не должен доходить, но защищаемся).
 */
export function filterActiveRoomsInWorkspace(
  rooms: WorkspaceRoom[],
  workspaceId: number | null,
): WorkspaceRoom[] {
  if (workspaceId === null) return [];
  return rooms.filter(
    (wr) => wr.workspace_id === workspaceId && wr.room.archived_at === null,
  );
}

/** Сортировка: алфавитная по `room.name`, locale-aware (русский корректно). */
export function sortRoomsByName(rooms: WorkspaceRoom[]): WorkspaceRoom[] {
  return [...rooms].sort((a, b) => a.room.name.localeCompare(b.room.name, "ru"));
}
