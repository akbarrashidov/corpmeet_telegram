import type { WorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { TelegramBindStatusBlock } from "./TelegramBindStatusBlock";
import { ArchiveWorkspaceBlock } from "./ArchiveWorkspaceBlock";

interface Props {
  workspace: WorkspaceDetail;
  onArchived: () => void;
}

/** Tab «Общее» в WorkspaceSettingsScreen.
 *
 * - TelegramBindStatusBlock — статус привязки + инструкция или «Отвязать»
 * - ArchiveWorkspaceBlock — только для owner
 */
export function GeneralSection({ workspace, onArchived }: Props) {
  const isOwner = workspace.my_role === "owner";

  return (
    <section className="flex flex-col gap-5">
      <TelegramBindStatusBlock workspace={workspace} />
      {isOwner && (
        <ArchiveWorkspaceBlock workspace={workspace} onArchived={onArchived} />
      )}
    </section>
  );
}
