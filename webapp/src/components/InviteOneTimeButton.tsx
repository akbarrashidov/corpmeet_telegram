import { useState } from "react";
import { useGenerateInviteLink } from "../hooks/useGenerateInviteLink";
import { useTranslation } from "../i18n";
import { copyToClipboard } from "../lib/clipboard";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspaceId: number;
}

const COPIED_FEEDBACK_MS = 2500;

/** Кнопка «Пригласить коллегу» — copy-on-create.
 *
 * Тап → POST /generate-invite-link → копируем invite_deep_link в буфер →
 * подсветка зелёная с «Скопировано ✓» на 2.5с → возврат на исходную надпись.
 */
export function InviteOneTimeButton({ workspaceId }: Props) {
  const { t } = useTranslation();
  const generate = useGenerateInviteLink(workspaceId);
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    haptic();
    try {
      const member = await generate.mutateAsync();
      const link = member?.invite_deep_link;
      if (!link) {
        hapticError();
        return;
      }
      const ok = await copyToClipboard(link);
      if (!ok) {
        hapticError();
        return;
      }
      hapticSuccess();
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      hapticError();
    }
  }

  const disabled = generate.isPending;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="rounded-lg p-3 font-semibold text-sm"
      style={{
        background: copied ? "var(--success, #16a34a)" : "var(--primary)",
        color: "white",
        opacity: disabled && !copied ? 0.5 : 1,
      }}
    >
      {disabled && !copied
        ? "..."
        : copied
          ? t("invitations.one_time.copied")
          : t("invitations.one_time.button")}
    </button>
  );
}
