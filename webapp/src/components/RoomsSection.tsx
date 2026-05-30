import { useState } from "react";
import type { WorkspaceRoom } from "@corpmeet/design/complex";
import { useWorkspaceRooms } from "../hooks/useWorkspaceRooms";
import { useArchiveRoom } from "../hooks/useArchiveRoom";
import { useWorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { CreateRoomForm } from "./CreateRoomForm";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspaceId: number;
}

/**
 * Секция «Переговорные» в WorkspaceSettingsScreen.
 *
 * Использует `useWorkspaceRooms()` — этот хук фильтрует по текущему wsId
 * из `useCurrentWorkspaceId`. Предполагается, что родитель (Settings screen)
 * вызывается ТОЛЬКО для current workspace — переключение происходит при
 * клике на шестерёнку в WorkspaceSelector.
 *
 * RBAC: только owner/admin могут создавать и архивировать. Member видит
 * read-only список.
 */
export function RoomsSection({ workspaceId }: Props) {
  const { t } = useTranslation();
  const { data: rooms, isLoading } = useWorkspaceRooms();
  const { data: workspace } = useWorkspaceDetail(workspaceId);
  const archive = useArchiveRoom();
  const [creatingMode, setCreatingMode] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<WorkspaceRoom | null>(null);

  const myRole = workspace?.my_role ?? null;
  const canManage = myRole === "owner" || myRole === "admin";

  async function handleConfirmArchive() {
    if (!confirmArchive) return;
    haptic();
    try {
      await archive.mutateAsync(confirmArchive.room.id);
      hapticSuccess();
      setConfirmArchive(null);
    } catch {
      hapticError();
    }
  }

  const activeRooms = rooms ?? [];
  const isLastRoom = activeRooms.length === 1;

  return (
    <section className="flex flex-col gap-3">
      {isLoading && (
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("app.connecting")}
        </p>
      )}

      {!isLoading && activeRooms.length === 0 && !creatingMode && (
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("rooms_section.empty")}
        </p>
      )}

      {activeRooms.length > 0 && (
        <ul className="flex flex-col gap-2">
          {activeRooms.map((wr) => (
            <li
              key={wr.id}
              className="p-3 rounded-lg flex items-center justify-between gap-2"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{wr.room.name}</div>
                {wr.role === "shared" && (
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {t("rooms_section.shared_badge")}
                  </div>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    haptic();
                    setConfirmArchive(wr);
                  }}
                  disabled={archive.isPending}
                  aria-label={t("rooms_section.archive_aria", { name: wr.room.name })}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--surface)",
                    color: "var(--danger)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {t("rooms_section.archive")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && creatingMode && (
        <div
          className="p-3 rounded-lg"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <CreateRoomForm
            workspaceId={workspaceId}
            onCreated={() => setCreatingMode(false)}
          />
          <button
            type="button"
            onClick={() => setCreatingMode(false)}
            className="mt-3 rounded-lg p-2.5 font-medium w-full"
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            {t("common.cancel")}
          </button>
        </div>
      )}

      {canManage && !creatingMode && (
        <button
          type="button"
          onClick={() => {
            haptic();
            setCreatingMode(true);
          }}
          className="rounded-lg p-3 font-semibold"
          style={{ background: "var(--primary)", color: "white" }}
        >
          + {t("rooms_section.create")}
        </button>
      )}

      <ConfirmDialog
        open={confirmArchive !== null}
        title={t("rooms_section.confirm.title", {
          name: confirmArchive?.room.name ?? "",
        })}
        body={
          isLastRoom
            ? t("rooms_section.confirm.last_room_warning")
            : t("rooms_section.confirm.body")
        }
        confirmLabel={t("rooms_section.confirm.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={handleConfirmArchive}
        onCancel={() => setConfirmArchive(null)}
      />
    </section>
  );
}
