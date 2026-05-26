import { useState } from "react";
import { apiClient, type Room } from "@corpmeet/design/complex";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "../i18n";
import { hapticError, hapticSuccess } from "../lib/haptic";

const inputStyle = {
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  color: "var(--text)",
};

interface Props {
  workspaceId: number;
  onCreated: (room: Room) => void;
}

/**
 * Форма создания комнаты в заданном workspace.
 * Mirror'ит `CreateWorkspaceForm`: POST к `/api/v1/rooms`, инвалидация
 * `["rooms", "mine"]` чтобы `useWorkspaceRooms` подхватил новую комнату.
 */
export function CreateRoomForm({ workspaceId, onCreated }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      hapticError();
      setError(t("create_room.error.name_required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<Room>("/api/v1/rooms", {
        name: name.trim(),
        workspace_id: workspaceId,
      });
      await queryClient.invalidateQueries({ queryKey: ["rooms", "mine"] });
      hapticSuccess();
      onCreated(res.data);
    } catch {
      hapticError();
      setError(t("create_room.error.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-xl">{t("create_room.title")}</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-sec)" }}>
          {t("create_room.subtitle")}
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm">{t("create_room.name.label")}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("create_room.name.placeholder")}
          disabled={busy}
          className="w-full rounded-lg p-3 outline-none"
          style={inputStyle}
        />
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
        {busy ? "..." : t("create_room.submit")}
      </button>
    </div>
  );
}
