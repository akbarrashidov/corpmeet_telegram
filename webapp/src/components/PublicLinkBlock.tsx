import { useState } from "react";
import type { WorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useTranslation } from "../i18n";
import { copyToClipboard } from "../lib/clipboard";
import { haptic, hapticSuccess } from "../lib/haptic";

interface Props {
  workspace: WorkspaceDetail;
}

const FALLBACK_BOT_USERNAME =
  (import.meta as any).env?.VITE_BOT_USERNAME ?? "corpmeet_dev_bot";
const COPIED_FEEDBACK_MS = 2000;

/** Блок публичной Telegram-ссылки workspace'а. */
export function PublicLinkBlock({ workspace }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("invitations.public_link.label")}</span>
      <p className="text-xs" style={{ color: "var(--text-sec)" }}>
        {t("invitations.public_link.subtitle")}
      </p>
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
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg p-2.5 font-medium text-sm"
        style={{
          background: copied ? "var(--success, #16a34a)" : "var(--surface)",
          color: copied ? "white" : "var(--text)",
          border: `1px solid ${copied ? "transparent" : "var(--border)"}`,
        }}
      >
        {copied ? t("invitations.public_link.copied") : t("invitations.public_link.copy")}
      </button>
    </div>
  );
}
