import { useEffect, useState } from "react";
import { useTranslation } from "../i18n";
import { copyToClipboard } from "../lib/clipboard";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticSuccess } from "../lib/haptic";

interface Props {
  open: boolean;
  roomName: string;
  inviteCode: string | null;
  onClose: () => void;
}

const COPIED_FEEDBACK_MS = 2000;

/**
 * Мини-вариант шеринга комнаты: код + копирование + share через Telegram.
 * Полноценные настройки (join_mode, visibility, approval) — в веб-версии.
 */
export function ShareModal({ open, roomName, inviteCode, onClose }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleCopy() {
    if (!inviteCode) return;
    haptic();
    const ok = await copyToClipboard(inviteCode);
    if (ok) {
      hapticSuccess();
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    }
  }

  function handleShareTg() {
    if (!inviteCode) return;
    haptic();
    const text = t("share_room.tg_text", { room: roomName, code: inviteCode });
    const shareUrl =
      `https://t.me/share/url?url=${encodeURIComponent("https://corpmeet.uz")}` +
      `&text=${encodeURIComponent(text)}`;
    const tg = getTelegram();
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("share_room.title", { room: roomName })}
      className="fixed inset-0 flex items-center justify-center p-6 z-50"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl p-5 w-full max-w-sm flex flex-col gap-4"
        style={{
          background: "var(--modal)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
      >
        <h2 className="font-semibold text-lg">
          {t("share_room.title", { room: roomName })}
        </h2>

        {inviteCode ? (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-sm" style={{ color: "var(--text-sec)" }}>
                {t("share_room.code_label")}
              </span>
              <div
                className="p-3 rounded-lg text-base font-mono break-all text-center"
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--input-border)",
                  color: "var(--text)",
                }}
              >
                {inviteCode}
              </div>
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
              {copied ? t("share_room.copied") : t("share_room.copy")}
            </button>

            <button
              type="button"
              onClick={handleShareTg}
              className="rounded-lg p-2.5 font-medium text-sm"
              style={{ background: "var(--primary)", color: "white" }}
            >
              {t("share_room.share_tg")}
            </button>

            <p
              className="text-xs"
              style={{ color: "var(--text-sec)", whiteSpace: "pre-line" }}
            >
              {t("share_room.hint_web")}
            </p>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-sec)" }}>
            {t("share_room.no_code")}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2.5 font-medium text-sm"
          style={{
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
