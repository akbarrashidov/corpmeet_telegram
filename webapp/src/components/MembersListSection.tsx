import { useState } from "react";
import { useAuth } from "@corpmeet/design/complex";
import {
  useWorkspaceDetail,
  type WorkspaceMember,
} from "../hooks/useWorkspaceDetail";
import { useRemoveMember } from "../hooks/useRemoveMember";
import { MemberListRow } from "./MemberListRow";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { PendingJoinRequests } from "./PendingJoinRequests";

interface Props {
  workspaceId: number;
}

/** Tab «Участники» в WorkspaceSettingsScreen.
 *
 * Список активных участников с именем, ролью, должностью.
 * Для owner/admin — inline-селектор должности на каждой строке.
 * Удалить — только для owner/admin (нельзя удалить себя или owner'а если ты admin).
 */
export function MembersListSection({ workspaceId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: wsDetail, isLoading } = useWorkspaceDetail(workspaceId);
  const removeMember = useRemoveMember(workspaceId);
  const [confirmRemove, setConfirmRemove] = useState<WorkspaceMember | null>(null);

  const myRole = wsDetail?.my_role ?? null;
  const canManage = myRole === "owner" || myRole === "admin";
  const activeMembers = (wsDetail?.members ?? []).filter(
    (m) => m.status === "active",
  );

  function canRemoveTarget(m: WorkspaceMember): boolean {
    if (!canManage) return false;
    if (m.user?.id === user?.id) return false;
    if (myRole === "admin" && m.role === "owner") return false;
    return true;
  }

  async function handleConfirm() {
    if (!confirmRemove) return;
    haptic();
    try {
      await removeMember.mutateAsync(confirmRemove.id);
      hapticSuccess();
      setConfirmRemove(null);
    } catch {
      hapticError();
    }
  }

  if (isLoading) {
    return (
      <p className="text-sm" style={{ color: "var(--text-sec)" }}>
        {t("app.connecting")}
      </p>
    );
  }

  if (activeMembers.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-sec)" }}>
        {t("members.empty")}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {canManage && <PendingJoinRequests workspaceId={workspaceId} />}
      <ul className="flex flex-col gap-2">
        {activeMembers.map((m) => (
          <MemberListRow
            key={m.id}
            member={m}
            workspaceId={workspaceId}
            canEditPosition={canManage}
            canRemove={canRemoveTarget(m)}
            onRemove={() => {
              haptic();
              setConfirmRemove(m);
            }}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={confirmRemove !== null}
        title={t("members_section.confirm_remove.title", {
          name: confirmRemove?.user?.display_name
            ?? confirmRemove?.pending_username
            ?? "",
        })}
        body={t("members_section.confirm_remove.body")}
        confirmLabel={t("members_section.confirm_remove.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmRemove(null)}
      />
    </section>
  );
}
