import { useState } from "react";
import { useAuth } from "@corpmeet/design/complex";
import { usePositions } from "../hooks/usePositions";
import { useWorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useUpdateMemberPosition } from "../hooks/useUpdateMemberPosition";
import { PositionPicker } from "./PositionPicker";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspaceId: number;
  onDone: () => void;
}

/**
 * Шаг onboarding'а: после создания должностей owner выбирает свою
 * (PATCH /members/{own_member_id} {position_id}). Без должности owner не
 * сможет создавать встречи — бэкенд вернёт 403.
 */
export function OwnerPositionPickStep({ workspaceId, onDone }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: positions, isLoading: posLoading } = usePositions(workspaceId);
  const { data: wsDetail, isLoading: detailLoading } = useWorkspaceDetail(workspaceId);
  const updatePosition = useUpdateMemberPosition(workspaceId);

  const [positionId, setPositionId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myMember = wsDetail?.members.find(
    (m) => m.user?.id === user?.id && m.status === "active",
  );
  const loading = posLoading || detailLoading;
  const canSubmit = positionId !== null && myMember !== undefined && !busy;

  async function handleSubmit() {
    if (!canSubmit || !myMember) return;
    setBusy(true);
    setError(null);
    haptic();
    try {
      await updatePosition.mutateAsync({ memberId: myMember.id, positionId });
      hapticSuccess();
      onDone();
    } catch {
      hapticError();
      setError(t("owner_position_pick.error.failed"));
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen p-6 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="mt-2">
        <h1 className="font-heading text-2xl">{t("owner_position_pick.title")}</h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-sec)" }}>
          {t("owner_position_pick.subtitle")}
        </p>
      </div>

      {loading && (
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("app.connecting")}
        </p>
      )}

      {!loading && (
        <div className="flex flex-col gap-2">
          <span className="text-sm">{t("owner_position_pick.label")}</span>
          <PositionPicker
            positions={positions ?? []}
            value={positionId}
            onChange={setPositionId}
            disabled={busy}
            ariaLabel={t("owner_position_pick.label")}
            allowClear={false}
          />
        </div>
      )}

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
        {busy ? "..." : t("common.save")}
      </button>
    </div>
  );
}
