import { PageHeader } from "../components/PageHeader";
import { RoomsSection } from "../components/RoomsSection";
import { useWorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { useTranslation } from "../i18n";
import { MembersSection } from "../components/MembersSection";
import { storage } from "@corpmeet/design/complex";
import { copyToClipboard } from "../lib/clipboard";
import { useState } from "react";

interface Props {
  workspaceId: number;
  onBack: () => void;
}

/**
 * Top-level экран настроек workspace.
 *
 * Открывается из шестерёнки рядом с workspace в WorkspaceSelector.
 * В PR-4 функциональна только секция Rooms. Остальные (General, Members,
 * Telegram) — placeholder'ы «Скоро», наполнятся в PR-5.
 */
export function WorkspaceSettingsScreen({ workspaceId, onBack }: Props) {
  const { t } = useTranslation();
  const { data: workspace, isLoading } = useWorkspaceDetail(workspaceId);

  useTgBackButton(onBack);

  const title = workspace?.name ?? t("ws_settings.title");
  const token = storage.getToken();
  const [tokenCopied, setTokenCopied] = useState(false);

  async function handleCopyToken() {
    if (!token) return;
    const ok = await copyToClipboard(token);
    if (ok) {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 3000);
    }
  }

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-6"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <PageHeader title={title} onBack={onBack} />
        {token && (
          <div
            className="p-3 rounded-lg flex flex-col gap-2"
            style={{
              background: "var(--surface)",
              border: "2px dashed orange",
            }}
          >
            <div className="text-xs font-bold" style={{ color: "orange" }}>
              ⚠️ DEBUG: Bearer токен (временно)
            </div>
            <div
              className="text-xs font-mono break-all"
              style={{ color: "var(--text)" }}
            >
              {token}
            </div>
            <button
              type="button"
              onClick={handleCopyToken}
              className="rounded-lg p-2 text-sm font-medium"
              style={{
                background: tokenCopied ? "var(--success, #16a34a)" : "var(--primary)",
                color: "white",
              }}
            >
              {tokenCopied ? "Скопировано ✓" : "Скопировать токен"}
            </button>
          </div>
        )}

      {isLoading && (
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("app.connecting")}
        </p>
      )}

      {workspace && (
        <>
          <Placeholder label={t("ws_settings.section.general")} />
          <MembersSection workspaceId={workspaceId} />
          <RoomsSection workspaceId={workspaceId} />
          <Placeholder label={t("ws_settings.section.telegram")} />
        </>
      )}
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="font-semibold text-base">{label}</h3>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Скоро
      </p>
    </section>
  );
}
