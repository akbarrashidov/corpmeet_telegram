import { useState } from "react";
import type { WorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useRegenerateInviteCode } from "../hooks/useRegenerateInviteCode";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "../i18n";
import { copyToClipboard } from "../lib/clipboard";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspace: WorkspaceDetail;
}

const FALLBACK_BOT_USERNAME =
  (import.meta as any).env?.VITE_BOT_USERNAME ?? "corpmeet_dev_bot";
const COPIED_FEEDBACK_MS = 2000;

/**
 * Блок публичной workspace-ссылки.
 *
 * Backend возвращает готовый `tg_invite_link` в `WorkspaceDetail`.
 * Если по какой-то причине его нет (старый бэкенд / null) — fallback на
 * конструирование URL из `invite_code` и хардкод-bot-username.
 *
 * Кнопки:
 * - Копировать (clipboard)
 * - Обновить код — POST /regenerate-code, после confirm-dialog
 */
export function PublicInviteLinkBlock({ workspace }: Props) {
  const { t } = useTranslation();
  const regenerate = useRegenerateInviteCode(workspace.id);
  const [copied, setCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const publicLink =
    workspace.tg_invite_link
    ?? `https://t.me/${FALLBACK_BOT_USERNAME}?start=ws_${workspace.invite_code}`;

  async function handleCopy() {
    haptic();
    const ok = await copyToClipboard(publicLink);
    if (ok) {
      hapticSuccess();
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    }
  }

  async function handleRegenerate() {
    haptic();
    try {
      await regenerate.mutateAsync();
      hapticSuccess();
      setConfirmRegen(false);
    } catch {
      hapticError();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">{t("members_section.public_link.label")}</span>
      <div
        className="p-3 rounded-lg text-xs font-mono break-all"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          color: "var(--text)",
        }}
      >
        {publicLink}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg p-2.5 font-medium text-sm"
          style={{
            background: copied ? "var(--success, #16a34a)" : "var(--primary)",
            color: "white",
          }}
        >
          {copied
            ? t("members_section.public_link.copied")
            : t("members_section.public_link.copy")}
        </button>

        <button
          type="button"
          onClick={() => {
            haptic();
            setConfirmRegen(true);
          }}
          disabled={regenerate.isPending}
          className="rounded-lg p-2.5 font-medium text-sm"
          style={{
            background: "var(--surface)",
            color: "var(--danger)",
            border: "1px solid var(--border)",
            opacity: regenerate.isPending ? 0.5 : 1,
          }}
        >
          {regenerate.isPending ? "..." : t("members_section.public_link.regenerate")}
        </button>
      </div>

      <ConfirmDialog
        open={confirmRegen}
        title={t("members_section.public_link.confirm_regen.title")}
        body={t("members_section.public_link.confirm_regen.body")}
        confirmLabel={t("members_section.public_link.confirm_regen.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={handleRegenerate}
        onCancel={() => setConfirmRegen(false)}
      />
    </div>
  );
}
