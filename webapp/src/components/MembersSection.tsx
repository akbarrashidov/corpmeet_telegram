import { useState } from "react";
import { useAuth } from "@corpmeet/design/complex";
import { useWorkspaceDetail, type WorkspaceMember } from "../hooks/useWorkspaceDetail";
import { useRemoveMember } from "../hooks/useRemoveMember";
import { MemberRow } from "./MemberRow";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspaceId: number;
}

/**
 * Секция «Members» в WorkspaceSettingsScreen.
 *
 * - Active members — список карточек, у admin/owner есть кнопка remove
 * - Pending members — отображаются в Commit 3 (когда будут invite-формы)
 *
 * Confirm dialog при remove (destructive action).
 * Owner не может удалить сам себя (через `canRemove=false`).
 */
export function MembersSection({ workspaceId }: Props) {
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
    // Owner не может удалить себя
    if (m.user?.id === user?.id) return false;
    // Admin не может удалить owner
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

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-semibold text-base">
        {t("members_section.title")}
      </h3>

      {isLoading && (
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          {t("app.connecting")}
        </p>
      )}

      {activeMembers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {activeMembers.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              canRemove={canRemoveTarget(m)}
              onRemove={() => {
                haptic();
                setConfirmRemove(m);
              }}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        title={t("members_section.confirm_remove.title", {
          name: confirmRemove?.user?.display_name ?? "",
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
