import { useTranslation, type TranslationKey } from "../i18n";
import type { WorkspaceMember } from "../hooks/useWorkspaceDetail";

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

export function MemberRow({ member, canRemove, onRemove }: Props) {
  const { t } = useTranslation();
  const displayName = member.user?.display_name ?? "—";
  const username = member.user?.username ? `@${member.user.username}` : null;

  return (
    <li
      className="p-3 rounded-lg flex items-center justify-between gap-2"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{displayName}</div>
        <div
          className="text-xs flex items-center gap-2"
          style={{ color: "var(--text-muted)" }}
        >
          <span>{t(ROLE_LABEL_KEY[member.role])}</span>
          {username && <span className="truncate">{username}</span>}
        </div>
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("members_section.remove_aria", { name: displayName })}
          className="rounded-lg px-3 py-2 text-sm"
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
