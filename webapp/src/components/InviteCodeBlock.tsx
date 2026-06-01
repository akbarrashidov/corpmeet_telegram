import { useState } from "react";
import type { WorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useTranslation } from "../i18n";
import { copyToClipboard } from "../lib/clipboard";
import { haptic, hapticSuccess } from "../lib/haptic";

interface Props {
  workspace: WorkspaceDetail;
}

const COPIED_FEEDBACK_MS = 2000;

/** Блок публичного `invite_code` workspace'а (read-only + Копировать). */
export function InviteCodeBlock({ workspace }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    haptic();
    const ok = await copyToClipboard(workspace.invite_code);
    if (ok) {
      hapticSuccess();
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("invitations.code.label")}</span>
      <div className="flex items-center gap-2">
        <div
          className="flex-1 p-3 rounded-lg text-sm font-mono break-all"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            color: "var(--text)",
          }}
        >
          {workspace.invite_code}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg px-3 py-2.5 font-medium text-sm whitespace-nowrap"
          style={{
            background: copied ? "var(--success, #16a34a)" : "var(--surface)",
            color: copied ? "white" : "var(--text)",
            border: `1px solid ${copied ? "transparent" : "var(--border)"}`,
          }}
        >
          {copied ? t("invitations.code.copied") : t("invitations.code.copy")}
        </button>
      </div>
    </div>
  );
}
