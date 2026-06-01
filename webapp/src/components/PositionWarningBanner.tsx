import { useAuth } from "@corpmeet/design/complex";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";
import { useWorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { usePositions } from "../hooks/usePositions";
import { useTranslation } from "../i18n";
import { haptic } from "../lib/haptic";

interface Props {
  onOpenProfile: () => void;
}

/**
 * Жёлтое предупреждение «У вас не указана должность» с CTA «Указать».
 *
 * Условия отображения:
 *  - есть текущий workspace
 *  - я в нём активный member
 *  - my member.position_id === null
 *  - в workspace есть хотя бы одна Position (иначе указывать нечего)
 */
export function PositionWarningBanner({ onOpenProfile }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const wsId = useCurrentWorkspaceId();
  const { data: wsDetail } = useWorkspaceDetail(wsId);
  const { data: positions } = usePositions(wsId);

  if (!user || !wsDetail || !positions || positions.length === 0) return null;

  const me = wsDetail.members.find(
    (m) => m.user?.id === user.id && m.status === "active",
  );
  if (!me || me.position_id !== null) return null;

  function handleClick() {
    haptic();
    onOpenProfile();
  }

  return (
    <div
      role="alert"
      className="p-3 rounded-lg flex items-center justify-between gap-3"
      style={{
        background: "rgba(234, 179, 8, 0.12)",
        border: "1px solid rgba(234, 179, 8, 0.4)",
        color: "var(--text)",
      }}
    >
      <span className="text-sm flex-1">
        ⚠️ {t("position_warning.message")}
      </span>
      <button
        type="button"
        onClick={handleClick}
        className="rounded-lg px-3 py-1.5 text-sm font-medium flex-shrink-0"
        style={{
          background: "rgb(234, 179, 8)",
          color: "white",
        }}
      >
        {t("position_warning.button")}
      </button>
    </div>
  );
}
