import { useState } from "react";
import { apiClient, type Workspace } from "@corpmeet/design/complex";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "../i18n";
import { hapticError, hapticSuccess } from "../lib/haptic";

const TIMEZONES = ["Asia/Tashkent", "Europe/Moscow", "UTC"];

const inputStyle = {
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  color: "var(--text)",
};

interface Props {
  onCreated: (ws: Workspace) => void;
}

export function CreateWorkspaceForm({ onCreated }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(TIMEZONES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      hapticError();
      setError(t("create_ws.error.name_required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<Workspace>("/api/v1/workspaces", {
        name: name.trim(),
        timezone,
      });
      await queryClient.invalidateQueries({ queryKey: ["workspaces", "mine"] });
      hapticSuccess();
      onCreated(res.data);
    } catch {
      hapticError();
      setError(t("create_ws.error.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">{t("create_ws.title")}</h2>

      <label className="flex flex-col gap-2">
        <span className="text-sm">{t("create_ws.name.label")}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("create_ws.name.placeholder")}
          disabled={busy}
          className="w-full rounded-lg p-3 outline-none"
          style={inputStyle}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">{t("create_ws.timezone.label")}</span>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          disabled={busy}
          className="w-full rounded-lg p-3 outline-none"
          style={inputStyle}
        >
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </label>

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy}
        className="rounded-lg p-3 font-semibold mt-2"
        style={{
          background: "var(--primary)",
          color: "white",
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? "..." : t("create_ws.submit")}
      </button>
    </div>
  );
}
