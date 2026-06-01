import { useTranslation, type TranslationKey } from "../i18n";
import type { WorkspaceMember } from "../hooks/useWorkspaceDetail";
import { usePositions } from "../hooks/usePositions";
import { useUpdateMemberPosition } from "../hooks/useUpdateMemberPosition";
import { PositionPicker } from "./PositionPicker";
import { getPositionLabel } from "../lib/positionLabel";
import { hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  member: WorkspaceMember;
  workspaceId: number;
  canEditPosition: boolean;
  canRemove: boolean;
  onRemove: () => void;
}

const ROLE_LABEL_KEY: Record<WorkspaceMember["role"], TranslationKey> = {
  owner: "members_section.role.owner",
  admin: "members_section.role.admin",
  member: "members_section.role.member",
};

export function MemberListRow({
  member,
  workspaceId,
  canEditPosition,
  canRemove,
  onRemove,
}: Props) {
  const { t, lang } = useTranslation();
  const { data: positions } = usePositions(workspaceId);
  const updatePosition = useUpdateMemberPosition(workspaceId);

  const displayName = member.user?.display_name ?? "—";
  const username = member.user?.username ? `@${member.user.username}` : null;
  const positionLabel = member.position
    ? getPositionLabel(member.position, lang)
    : null;
  const roleLabel = t(ROLE_LABEL_KEY[member.role]);
  const isPending = member.status === "pending" || !member.user;

  async function handlePositionChange(positionId: number | null) {
    try {
      await updatePosition.mutateAsync({ memberId: member.id, positionId });
      hapticSuccess();
    } catch {
      hapticError();
    }
  }

  return (
    <li
      className="p-3 rounded-lg flex items-start justify-between gap-2"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="font-medium truncate">{displayName}</div>
        <div
          className="text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          <span>{roleLabel}</span>
        </div>
        {username && (
          <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {username}
          </div>
        )}

        {canEditPosition && !isPending && (positions ?? []).length > 0 ? (
          <div className="mt-1">
            <PositionPicker
              positions={positions ?? []}
              value={member.position_id}
              onChange={handlePositionChange}
              disabled={updatePosition.isPending}
              ariaLabel={t("member_position.label_aria", { name: displayName })}
            />
          </div>
        ) : positionLabel ? (
          <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
            {positionLabel}
          </div>
        ) : null}

      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("members_section.remove_aria", { name: displayName })}
          className="rounded-lg px-3 py-2 text-sm flex-shrink-0"
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
  );
}
