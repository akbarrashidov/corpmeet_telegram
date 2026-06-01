import type { WorkspacePosition } from "../hooks/usePositions";
import { useTranslation } from "../i18n";
import { getPositionLabel } from "../lib/positionLabel";

interface Props {
  positions: WorkspacePosition[];
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Нативный <select> для выбора должности. Опция «—» = снять должность (null).
 * Reusable: ProfileScreen (self), MemberListRow (admin → other).
 * Лейбл локализуется через текущий язык.
 */
export function PositionPicker({ positions, value, onChange, disabled, ariaLabel }: Props) {
  const { lang } = useTranslation();
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className="rounded-lg p-2 text-sm outline-none"
      style={{
        background: "var(--input-bg)",
        border: "1px solid var(--input-border)",
        color: "var(--text)",
      }}
    >
      <option value="">—</option>
      {positions.map((p) => (
        <option key={p.id} value={p.id}>
          {getPositionLabel(p, lang)}
        </option>
      ))}
    </select>
  );
}
