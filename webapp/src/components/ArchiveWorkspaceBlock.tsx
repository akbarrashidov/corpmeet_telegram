import { useState } from "react";
import type { WorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useArchiveWorkspace } from "../hooks/useArchiveWorkspace";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspace: WorkspaceDetail;
  onArchived: () => void;
}

/** Архивирование пространства. Виден только владельцу (gate в parent'е). */
export function ArchiveWorkspaceBlock({ workspace, onArchived }: Props) {
  const { t } = useTranslation();
  const archive = useArchiveWorkspace(workspace.id);
  const [confirm, setConfirm] = useState(false);

  async function handleArchive() {
    haptic();
    try {
      await archive.mutateAsync();
      hapticSuccess();
      setConfirm(false);
      onArchived();
    } catch {
      hapticError();
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold text-base">{t("general.archive.title")}</h3>
      <button
        type="button"
        onClick={() => {
          haptic();
          setConfirm(true);
        }}
        disabled={archive.isPending}
        className="rounded-lg p-3 font-semibold text-sm"
        style={{
          background: "var(--surface)",
          color: "var(--danger)",
          border: "1px solid var(--danger)",
          opacity: archive.isPending ? 0.5 : 1,
        }}
      >
        {archive.isPending ? "..." : t("general.archive.button")}
      </button>

      <ConfirmDialog
        open={confirm}
        title={t("general.archive.confirm.title", { name: workspace.name })}
        body={t("general.archive.confirm.body")}
        confirmLabel={t("general.archive.confirm.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={handleArchive}
        onCancel={() => setConfirm(false)}
      />
    </section>
  );
}
