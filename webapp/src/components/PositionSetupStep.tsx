import { useState } from "react";
import { useCreatePosition } from "../hooks/usePositions";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspaceId: number;
  onDone: () => void;
}

interface Pair {
  ru: string;
  uz: string;
}

/**
 * Шаг onboarding'а для owner'а сразу после создания workspace.
 *
 * Owner обязан создать минимум 1 должность (RU + UZ оба required) перед тем
 * как попадёт в workspace — backend больше не сидит дефолты при create.
 * Можно добавить несколько за раз; submit делает POST по каждой.
 */
export function PositionSetupStep({ workspaceId, onDone }: Props) {
  const { t } = useTranslation();
  const create = useCreatePosition(workspaceId);
  const [pairs, setPairs] = useState<Pair[]>([{ ru: "", uz: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setRu(i: number, v: string) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, ru: v } : p)));
  }
  function setUz(i: number, v: string) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, uz: v } : p)));
  }
  function addRow() {
    haptic();
    setPairs((prev) => [...prev, { ru: "", uz: "" }]);
  }
  function removeRow(i: number) {
    if (pairs.length === 1) return;
    haptic();
    setPairs((prev) => prev.filter((_, idx) => idx !== i));
  }

  const validPairs = pairs
    .map((p) => ({ ru: p.ru.trim(), uz: p.uz.trim() }))
    .filter((p) => p.ru && p.uz);
  const canSubmit =
    !busy &&
    pairs.length > 0 &&
    pairs.every((p) => p.ru.trim() && p.uz.trim());

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    haptic();
    try {
      for (const pair of validPairs) {
        await create.mutateAsync({ name_ru: pair.ru, name_uz: pair.uz });
      }
      hapticSuccess();
      onDone();
    } catch {
      hapticError();
      setError(t("position_setup.error.failed"));
      setBusy(false);
    }
  }

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text)",
  };

  return (
    <div
      className="min-h-screen p-6 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="mt-2">
        <h1 className="font-heading text-2xl">{t("position_setup.title")}</h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-sec)" }}>
          {t("position_setup.subtitle")}
        </p>
      </div>

      <ul className="flex flex-col gap-3 mt-2">
        {pairs.map((p, i) => (
          <li
            key={i}
            className="p-3 rounded-lg flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <input
              type="text"
              value={p.ru}
              onChange={(e) => setRu(i, e.target.value)}
              maxLength={100}
              placeholder={t("positions_section.name_ru_placeholder")}
              aria-label={t("positions_section.name_ru_label")}
              className="rounded-lg p-2 text-sm"
              style={inputStyle}
              disabled={busy}
            />
            <input
              type="text"
              value={p.uz}
              onChange={(e) => setUz(i, e.target.value)}
              maxLength={100}
              placeholder={t("positions_section.name_uz_placeholder")}
              aria-label={t("positions_section.name_uz_label")}
              className="rounded-lg p-2 text-sm"
              style={inputStyle}
              disabled={busy}
            />
            {pairs.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={busy}
                aria-label={t("position_setup.remove_aria", { index: i + 1 })}
                className="self-end rounded-lg px-3 py-1 text-xs"
                style={{
                  background: "var(--surface)",
                  color: "var(--danger)",
                  border: "1px solid var(--border)",
                }}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addRow}
        disabled={busy}
        className="rounded-lg p-2 text-sm"
        style={{
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
      >
        + {t("position_setup.add_more")}
      </button>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="rounded-lg p-3 font-semibold mt-auto"
        style={{
          background: "var(--primary)",
          color: "white",
          opacity: canSubmit ? 1 : 0.5,
        }}
      >
        {busy ? "..." : t("position_setup.submit")}
      </button>
    </div>
  );
}
