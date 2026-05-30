import { useState } from "react";
import { useGenerateInviteLink } from "../hooks/useGenerateInviteLink";
import { useTranslation } from "../i18n";
import { copyToClipboard } from "../lib/clipboard";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspaceId: number;
}

const COPIED_FEEDBACK_MS = 2500;

type State =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "ready"; link: string }
  | { kind: "copied"; link: string };

/** Кнопка «Пригласить коллегу» — двухтапный flow:
 *
 * 1. idle → тап → mutation создаёт invite_deep_link → ready (показывает ссылку)
 * 2. ready → тап → синхронный copyToClipboard (user-gesture сохранён, iOS ok) → copied
 * 3. copied → 2.5с → idle
 *
 * Раздельные тапы нужны потому что iOS Safari/Telegram WebView блокирует
 * clipboard API если до него был `await` — user-gesture context истекает.
 */
export function InviteOneTimeButton({ workspaceId }: Props) {
  const { t } = useTranslation();
  const generate = useGenerateInviteLink(workspaceId);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleClick() {
    haptic();

    // Если ссылка уже сгенерена — копируем синхронно в user-gesture контексте
    if (state.kind === "ready" || state.kind === "copied") {
      const link = state.link;
      const ok = await copyToClipboard(link);
      if (ok) {
        hapticSuccess();
        setState({ kind: "copied", link });
        setTimeout(() => {
          setState((cur) => (cur.kind === "copied" ? { kind: "idle" } : cur));
        }, COPIED_FEEDBACK_MS);
      } else {
        hapticError();
      }
      return;
    }

    // idle → generating
    setState({ kind: "generating" });
    try {
      const member = await generate.mutateAsync();
      const link = member?.invite_deep_link;
      if (!link) {
        hapticError();
        setState({ kind: "idle" });
        return;
      }
      hapticSuccess();
      setState({ kind: "ready", link });
    } catch {
      hapticError();
      setState({ kind: "idle" });
    }
  }

  const showCopied = state.kind === "copied";
  const showSpinner = state.kind === "generating";
  const link = state.kind === "ready" || state.kind === "copied" ? state.link : null;

  let buttonLabel: string;
  if (showSpinner) buttonLabel = "...";
  else if (showCopied) buttonLabel = t("invitations.one_time.copied");
  else if (state.kind === "ready") buttonLabel = t("invitations.one_time.copy");
  else buttonLabel = t("invitations.one_time.button");

  return (
    <div className="flex flex-col gap-2">
      {link && (
        <div
          className="p-3 rounded-lg text-xs font-mono break-all"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            color: "var(--text)",
          }}
        >
          {link}
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={showSpinner}
        className="rounded-lg p-3 font-semibold text-sm"
        style={{
          background: showCopied ? "var(--success, #16a34a)" : "var(--primary)",
          color: "white",
          opacity: showSpinner ? 0.5 : 1,
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
