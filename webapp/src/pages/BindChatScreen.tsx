import { useState } from "react";
import { apiClient, type Workspace } from "@corpmeet/design/complex";
import { useWorkspaces } from "../hooks/useWorkspaces";
import { useTranslation } from "../i18n";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  chatId: number;
}

export function BindChatScreen({ chatId }: Props) {
  const { t } = useTranslation();
  const { data: workspaces, isLoading } = useWorkspaces();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Workspace | null>(null);

  const adminable = (workspaces ?? []).filter(
    (w) => w.my_role === "owner" || w.my_role === "admin",
  );

  async function handleSubmit() {
    if (selectedId === null) return;
    setBusy(true);
    setError(null);
    haptic();
    try {
      await apiClient.patch(`/api/v1/workspaces/${selectedId}`, {
        telegram_chat_id: chatId,
      });
      const target = adminable.find((w) => w.id === selectedId) ?? null;
      hapticSuccess();
      setDone(target);
    } catch {
      hapticError();
      setError(t("bind.error.failed"));
    } finally {
      setBusy(false);
    }
  }

  function closeApp() {
    const tg = getTelegram();
    if (tg) tg.close();
  }

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <p>{t("app.connecting")}</p>
      </div>
    );
  }

  if (done !== null) {
    return (
      <div
        className="min-h-screen p-6 flex flex-col gap-4 items-center justify-center text-center"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <div className="text-5xl">✅</div>
        <h2 className="font-heading text-2xl">{t("bind.success_title")}</h2>
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("bind.success_body", { name: done.name })}
        </p>
        <button
          type="button"
          onClick={closeApp}
          className="mt-4 rounded-lg p-3 font-semibold w-full max-w-sm"
          style={{ background: "var(--primary)", color: "white" }}
        >
          {t("common.close")}
        </button>
      </div>
    );
  }

  if (adminable.length === 0) {
    return (
      <div
        className="min-h-screen p-6 flex flex-col gap-3 items-center justify-center text-center"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <div className="text-4xl">🏢</div>
        <h2 className="font-heading text-xl">{t("bind.no_workspace_title")}</h2>
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("bind.no_workspace_body")}
        </p>
        <button
          type="button"
          onClick={closeApp}
          className="mt-4 rounded-lg p-3 font-semibold w-full max-w-sm"
          style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          {t("common.close")}
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <h1 className="font-heading text-2xl">{t("bind.title")}</h1>
      <p className="text-sm" style={{ color: "var(--text-sec)" }}>
        {t("bind.subtitle")}
      </p>

      <ul className="flex flex-col gap-2">
        {adminable.map((w) => (
          <li key={w.id}>
            <label
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer"
              style={{
                background:
                  selectedId === w.id ? "var(--primary-light)" : "var(--surface)",
                border: `1px solid ${
                  selectedId === w.id ? "var(--primary)" : "var(--border)"
                }`,
              }}
            >
              <input
                type="radio"
                name="workspace"
                value={w.id}
                checked={selectedId === w.id}
                onChange={() => setSelectedId(w.id)}
              />
              <div className="flex-1">
                <div className="font-medium">{w.name}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {t(
                    w.my_role === "owner"
                      ? "bind.role.owner"
                      : "bind.role.admin"
                  )}
                </div>
              </div>
              {w.telegram_chat_id !== null && (
                <span className="text-xs" style={{ color: "var(--warning)" }}>
                  {t("bind.already_bound")}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={selectedId === null || busy}
        className="mt-auto rounded-lg p-3 font-semibold"
        style={{
          background: "var(--primary)",
          color: "white",
          opacity: selectedId === null || busy ? 0.5 : 1,
        }}
      >
        {busy ? "..." : t("bind.submit")}
      </button>
    </div>
  );
}
