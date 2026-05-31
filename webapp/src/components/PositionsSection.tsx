import { useState } from "react";
import {
  usePositions,
  useCreatePosition,
  useUpdatePosition,
  useDeletePosition,
  type WorkspacePosition,
} from "../hooks/usePositions";
import { useWorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspaceId: number;
}

interface FormProps {
  initialRu?: string;
  initialUz?: string;
  busy?: boolean;
  onSave: (nameRu: string, nameUz: string) => Promise<void>;
  onCancel: () => void;
}

/** Inline-форма для создания/редактирования. 2 input'а + ✓/✗. */
function PositionForm({ initialRu = "", initialUz = "", busy, onSave, onCancel }: FormProps) {
  const { t } = useTranslation();
  const [ru, setRu] = useState(initialRu);
  const [uz, setUz] = useState(initialUz);

  const trimmedRu = ru.trim();
  const trimmedUz = uz.trim();
  const canSave = trimmedRu.length > 0 && trimmedUz.length > 0 && !busy;

  async function handleSave() {
    if (!canSave) return;
    await onSave(trimmedRu, trimmedUz);
  }

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text)",
  };

  return (
    <div className="flex flex-col gap-2 flex-1">
      <input
        type="text"
        value={ru}
        onChange={(e) => setRu(e.target.value)}
        maxLength={100}
        placeholder={t("positions_section.name_ru_placeholder")}
        aria-label={t("positions_section.name_ru_label")}
        className="rounded-lg p-2 text-sm"
        style={inputStyle}
      />
      <input
        type="text"
        value={uz}
        onChange={(e) => setUz(e.target.value)}
        maxLength={100}
        placeholder={t("positions_section.name_uz_placeholder")}
        aria-label={t("positions_section.name_uz_label")}
        className="rounded-lg p-2 text-sm"
        style={inputStyle}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 rounded-lg p-2 text-sm font-medium"
          style={{
            background: canSave ? "var(--primary)" : "var(--surface)",
            color: canSave ? "white" : "var(--text-muted)",
            border: "1px solid var(--border)",
            opacity: canSave ? 1 : 0.5,
          }}
        >
          {t("common.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-lg p-2 text-sm"
          style={{
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

/**
 * Секция «Должности» в WorkspaceSettingsScreen.
 *
 * Только для owner/admin (member этот таб не видит вообще). Внутри ещё раз
 * проверяем `canManage` — на случай если member как-то сюда попал.
 *
 * UX:
 * - Список с inline-редактом (✏️ → 2 input'а + ✓/✗).
 * - Удаление через ConfirmDialog с подсчётом затронутых участников.
 * - Cascade SET NULL на бэке — у участников position_id обнулится автоматически.
 */
export function PositionsSection({ workspaceId }: Props) {
  const { t, lang } = useTranslation();
  const { data: positions, isLoading } = usePositions(workspaceId);
  const { data: workspace } = useWorkspaceDetail(workspaceId);
  const create = useCreatePosition(workspaceId);
  const update = useUpdatePosition(workspaceId);
  const remove = useDeletePosition(workspaceId);

  const [creatingMode, setCreatingMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WorkspacePosition | null>(null);

  const myRole = workspace?.my_role ?? null;
  const canManage = myRole === "owner" || myRole === "admin";
  const list = positions ?? [];

  // Считаем людей с этой должностью — для confirm body
  function countMembers(positionId: number): number {
    if (!workspace) return 0;
    const all = [...workspace.members, ...workspace.pending_members];
    return all.filter((m) => m.position_id === positionId).length;
  }

  async function handleCreate(nameRu: string, nameUz: string) {
    haptic();
    try {
      await create.mutateAsync({ name_ru: nameRu, name_uz: nameUz });
      hapticSuccess();
      setCreatingMode(false);
    } catch {
      hapticError();
    }
  }

  async function handleUpdate(id: number, nameRu: string, nameUz: string) {
    haptic();
    try {
      await update.mutateAsync({ id, body: { name_ru: nameRu, name_uz: nameUz } });
      hapticSuccess();
      setEditingId(null);
    } catch {
      hapticError();
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    haptic();
    try {
      await remove.mutateAsync(confirmDelete.id);
      hapticSuccess();
      setConfirmDelete(null);
    } catch {
      hapticError();
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {isLoading && (
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("app.connecting")}
        </p>
      )}

      {!isLoading && list.length === 0 && !creatingMode && (
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("positions_section.empty")}
        </p>
      )}

      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((p) => {
            const isEditing = editingId === p.id;
            const localized = lang === "uz" ? p.name_uz : p.name_ru;
            const secondary = lang === "uz" ? p.name_ru : p.name_uz;
            return (
              <li
                key={p.id}
                className="p-3 rounded-lg flex items-start justify-between gap-2"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                {isEditing ? (
                  <PositionForm
                    initialRu={p.name_ru}
                    initialUz={p.name_uz}
                    busy={update.isPending}
                    onSave={(ru, uz) => handleUpdate(p.id, ru, uz)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{localized}</div>
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {secondary}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            haptic();
                            setEditingId(p.id);
                          }}
                          aria-label={t("positions_section.edit_aria", { name: localized })}
                          className="rounded-lg px-3 py-2 text-sm"
                          style={{
                            background: "var(--surface)",
                            color: "var(--text)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            haptic();
                            setConfirmDelete(p);
                          }}
                          disabled={remove.isPending}
                          aria-label={t("positions_section.delete_aria", { name: localized })}
                          className="rounded-lg px-3 py-2 text-sm"
                          style={{
                            background: "var(--surface)",
                            color: "var(--danger)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
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
          <PositionForm
            busy={create.isPending}
            onSave={handleCreate}
            onCancel={() => setCreatingMode(false)}
          />
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
          + {t("positions_section.create")}
        </button>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("positions_section.confirm_delete.title", {
          name: confirmDelete
            ? lang === "uz" ? confirmDelete.name_uz : confirmDelete.name_ru
            : "",
        })}
        body={
          confirmDelete && countMembers(confirmDelete.id) > 0
            ? t("positions_section.confirm_delete.body_with_count", {
                count: countMembers(confirmDelete.id),
              })
            : t("positions_section.confirm_delete.body")
        }
        confirmLabel={t("positions_section.confirm_delete.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
