import { useState } from "react";
import type { WorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useRebindWorkspace } from "../hooks/useRebindWorkspace";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspace: WorkspaceDetail;
}

const BOT_USERNAME =
  (import.meta as any).env?.VITE_BOT_USERNAME ?? "corpmeet_dev_bot";

export function TelegramBindStatusBlock({ workspace }: Props) {
  const { t } = useTranslation();
  const rebind = useRebindWorkspace(workspace.id);
  const [confirmUnbind, setConfirmUnbind] = useState(false);

  const isBound = workspace.telegram_chat_id !== null;

  async function handleUnbind() {
    haptic();
    try {
      await rebind.mutateAsync(null);
      hapticSuccess();
      setConfirmUnbind(false);
    } catch {
      hapticError();
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold text-base">{t("general.bind.title")}</h3>

      {!isBound && (
        <div
          className="p-3 rounded-lg flex flex-col gap-2 text-sm"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-sec)",
          }}
        >
          <p>{t("general.bind.hint_unbound.intro")}</p>
          <ol className="list-decimal list-inside flex flex-col gap-1">
            <li>{t("general.bind.hint_unbound.step1", { bot: `@${BOT_USERNAME}` })}</li>
            <li>{t("general.bind.hint_unbound.step2")}</li>
            <li>{t("general.bind.hint_unbound.step3")}</li>
          </ol>
        </div>
      )}

      {isBound && (
        <>
          <div
            className="p-3 rounded-lg text-sm"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            <p>
              {t("general.bind.hint_bound", {
                chatId: String(workspace.telegram_chat_id),
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic();
              setConfirmUnbind(true);
            }}
            disabled={rebind.isPending}
            className="rounded-lg p-2.5 font-medium text-sm"
            style={{
              background: "var(--surface)",
              color: "var(--danger)",
              border: "1px solid var(--border)",
              opacity: rebind.isPending ? 0.5 : 1,
            }}
          >
            {rebind.isPending ? "..." : t("general.bind.unbind")}
          </button>
        </>
      )}

      <ConfirmDialog
        open={confirmUnbind}
        title={t("general.bind.confirm_unbind.title")}
        body={t("general.bind.confirm_unbind.body")}
        confirmLabel={t("general.bind.confirm_unbind.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={handleUnbind}
        onCancel={() => setConfirmUnbind(false)}
      />
    </section>
  );
}
