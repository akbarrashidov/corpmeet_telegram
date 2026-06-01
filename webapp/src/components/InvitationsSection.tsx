import { useState } from "react";
import type { WorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useRegenerateInviteCode } from "../hooks/useRegenerateInviteCode";
import { InviteOneTimeButton } from "./InviteOneTimeButton";
import { InviteCodeBlock } from "./InviteCodeBlock";
import { PublicLinkBlock } from "./PublicLinkBlock";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspace: WorkspaceDetail;
}

/** Tab «Приглашения» в WorkspaceSettingsScreen.
 *
 * - Пригласить коллегу (одноразовая ссылка, copy-on-create)
 * - Инвайт-код (публичный, read-only)
 * - Публичная Telegram-ссылка (read-only)
 * - Обновить — POST /regenerate-code (меняет код и ссылку атомарно)
 */
export function InvitationsSection({ workspace }: Props) {
  const { t } = useTranslation();
  const regenerate = useRegenerateInviteCode(workspace.id);
  const [confirm, setConfirm] = useState(false);

  async function handleRegenerate() {
    haptic();
    try {
      await regenerate.mutateAsync();
      hapticSuccess();
      setConfirm(false);
    } catch {
      hapticError();
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <InviteOneTimeButton workspaceId={workspace.id} />
      <InviteCodeBlock workspace={workspace} />
      <PublicLinkBlock workspace={workspace} />
      <button
        type="button"
        onClick={() => {
          haptic();
          setConfirm(true);
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
        {regenerate.isPending ? "..." : t("invitations.regenerate.button")}
      </button>

      <ConfirmDialog
        open={confirm}
        title={t("invitations.regenerate.confirm.title")}
        body={t("invitations.regenerate.confirm.body")}
        confirmLabel={t("invitations.regenerate.confirm.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={handleRegenerate}
        onCancel={() => setConfirm(false)}
      />
    </section>
  );
}
