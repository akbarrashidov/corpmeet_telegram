import { useTranslation, type TranslationKey } from "../i18n";
import type { WorkspaceMember } from "../hooks/useWorkspaceDetail";
import { getPositionLabel } from "../lib/positionLabel";

interface Props {
  member: WorkspaceMember;
  canRemove: boolean;
  onRemove: () => void;
}

const ROLE_LABEL_KEY: Record<WorkspaceMember["role"], TranslationKey> = {
  owner: "members_section.role.owner",
  admin: "members_section.role.admin",
  member: "members_section.role.member",
};

export function MemberListRow({ member, canRemove, onRemove }: Props) {
  const { t, lang } = useTranslation();
  const displayName = member.user?.display_name ?? "—";
  const username = member.user?.username ? `@${member.user.username}` : null;
  const positionLabel = member.position
    ? getPositionLabel(member.position, lang)
    : null;
  const roleLabel = t(ROLE_LABEL_KEY[member.role]);

  return (
    <li
      className="p-3 rounded-lg flex items-start justify-between gap-2"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="font-medium truncate">{displayName}</div>
        <div
          className="text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          {positionLabel && <span className="truncate">{positionLabel}</span>}
          {positionLabel && <span aria-hidden>·</span>}
          <span>{roleLabel}</span>
        </div>
        {username && (
          <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {username}
          </div>
        )}
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
