import { useState } from "react";
import { useTranslation } from "../i18n";
import { copyToClipboard } from "../lib/clipboard";
import { haptic, hapticSuccess } from "../lib/haptic";
import type { WorkspaceMember } from "../hooks/useWorkspaceDetail";
import { getInviteDeepLink } from "../lib/inviteCache";

interface Props {
  member: WorkspaceMember;
  canManage: boolean;
  onRevoke: () => void;
}

const COPIED_FEEDBACK_MS = 2000;

export function PendingInviteRow({ member, canManage, onRevoke }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const label = member.pending_username
    ? `@${member.pending_username}`
    : t("members_section.pending.anonymous");
  // Backend не отдаёт invite_deep_link в GET — fallback на localStorage кэш
  const deepLink = member.invite_deep_link ?? getInviteDeepLink(member.id);
  const hasLink = !!deepLink;

  async function handleCopy() {
    if (!deepLink) return;
    haptic();
    const ok = await copyToClipboard(deepLink);
    if (ok) {
      hapticSuccess();
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    }
  }

  return (
    <li
      className="p-3 rounded-lg flex flex-col gap-2"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{label}</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("members_section.pending.badge")}
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              haptic();
              onRevoke();
            }}
            aria-label={t("members_section.revoke_aria", { name: label })}
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--surface)",
              color: "var(--danger)",
              border: "1px solid var(--border)",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {hasLink && canManage && (
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg p-2 text-sm font-medium"
          style={{
            background: copied ? "var(--success, #16a34a)" : "var(--primary)",
            color: "white",
          }}
        >
          {copied
            ? t("members_section.pending.copied")
            : t("members_section.pending.copy_link")}
        </button>
      )}
    </li>
  );
}

