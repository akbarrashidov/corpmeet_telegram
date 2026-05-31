import { useWorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useDecideJoinRequest } from "../hooks/useDecideJoinRequest";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspaceId: number;
}

/**
 * Список ожидающих одобрения заявок на вступление (POST /workspaces/join → pending).
 *
 * Источник: `workspace.pending_members` с `user_id !== null` и `status === "pending"`.
 * Записи с user_id===null (admin-invitation по username) — отдельная сущность,
 * рендерятся в InvitationsSection, здесь не показываются.
 *
 * Empty → секция не рендерится (parent проверяет canManage перед монтированием).
 */
export function PendingJoinRequests({ workspaceId }: Props) {
  const { t } = useTranslation();
  const { data: workspace } = useWorkspaceDetail(workspaceId);
  const decide = useDecideJoinRequest(workspaceId);

  const requests = (workspace?.pending_members ?? []).filter(
    (m) => m.user_id !== null && m.status === "pending",
  );

  if (requests.length === 0) return null;

  async function handleDecide(memberId: number, approve: boolean) {
    haptic();
    try {
      await decide.mutateAsync({ memberId, approve });
      hapticSuccess();
    } catch {
      hapticError();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        📥 {t("pending_requests.heading", { count: requests.length })}
      </h3>
      <ul className="flex flex-col gap-2">
        {requests.map((m) => {
          const name = m.user?.display_name ?? m.pending_username ?? "—";
          const username = m.user?.username ? `@${m.user.username}` : null;
          return (
            <li
              key={m.id}
              className="p-3 rounded-lg flex items-start justify-between gap-2"
              style={{
                background: "rgba(234, 179, 8, 0.08)",
                border: "1px solid rgba(234, 179, 8, 0.3)",
              }}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="font-medium truncate">{name}</div>
                {username && (
                  <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {username}
                  </div>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleDecide(m.id, true)}
                  disabled={decide.isPending}
                  aria-label={t("pending_requests.accept_aria", { name })}
                  className="rounded-lg px-3 py-2 text-sm font-medium"
                  style={{
                    background: "var(--primary)",
                    color: "white",
                    opacity: decide.isPending ? 0.5 : 1,
                  }}
                >
                  {t("pending_requests.accept")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDecide(m.id, false)}
                  disabled={decide.isPending}
                  aria-label={t("pending_requests.reject_aria", { name })}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--surface)",
                    color: "var(--danger)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {t("pending_requests.reject")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
