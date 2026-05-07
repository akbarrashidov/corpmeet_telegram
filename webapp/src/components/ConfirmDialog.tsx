import { ReactNode, useEffect } from "react";
import { useTranslation } from "../i18n";

interface Props {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  variant = "primary",
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmBg = variant === "danger" ? "var(--danger)" : "var(--primary)";
  const finalConfirmLabel = confirmLabel ?? t("common.confirm");
  const finalCancelLabel = cancelLabel ?? t("common.cancel");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center p-6 z-50"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl p-5 w-full max-w-sm flex flex-col gap-3"
        style={{
          background: "var(--modal)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
      >
        <h2 className="font-semibold text-lg">{title}</h2>
        {body && <div className="text-sm" style={{ color: "var(--text-sec)" }}>{body}</div>}
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg p-2.5 font-medium"
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            {finalCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg p-2.5 font-semibold"
            style={{ background: confirmBg, color: "white" }}
          >
            {finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
