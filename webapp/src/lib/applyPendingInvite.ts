import { apiClient } from "@corpmeet/design/complex";

interface InviteParams {
  inviteToken: string | null;
  wsCode: string | null;
}

/** Парсит `?invite_token=…` и `?ws_code=…` из URL Mini App. */
export function parseInviteParams(): InviteParams {
  if (typeof window === "undefined") {
    return { inviteToken: null, wsCode: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    inviteToken: params.get("invite_token"),
    wsCode: params.get("ws_code"),
  };
}

/** Удаляет `invite_token` / `ws_code` из URL без перезагрузки страницы.
 *
 * Чтобы при F5 не повторять claim/join (один раз — и хватит).
 */
function clearInviteParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  if (url.searchParams.has("invite_token")) {
    url.searchParams.delete("invite_token");
    changed = true;
  }
  if (url.searchParams.has("ws_code")) {
    url.searchParams.delete("ws_code");
    changed = true;
  }
  if (changed) {
    window.history.replaceState({}, "", url.toString());
  }
}

/**
 * После успешного login/register — если в URL есть invite-токен или ws-код,
 * вызывает соответствующий backend endpoint, чтобы добавить юзера в workspace.
 *
 * - `invite_token` → `POST /api/v1/workspaces/claim-invite` (одноразовый)
 * - `ws_code` → `POST /api/v1/workspaces/join` (универсальная ссылка)
 *
 * Ошибки **не пробрасываются** — токен мог быть истёкшим/использованным,
 * это нормально, юзер просто продолжит обычный flow (Onboarding / home).
 *
 * URL очищается после попытки — чтобы рестарт не повторил.
 */
export async function applyPendingInvite(): Promise<void> {
  const { inviteToken, wsCode } = parseInviteParams();
  if (!inviteToken && !wsCode) return;

  try {
    if (inviteToken) {
      await apiClient.post("/api/v1/workspaces/claim-invite", {
        invite_token: inviteToken,
      });
    } else if (wsCode) {
      await apiClient.post("/api/v1/workspaces/join", {
        invite_code: wsCode,
      });
    }
  } catch {
    // silent — invalid/used token. Юзер увидит обычный flow.
  } finally {
    clearInviteParamsFromUrl();
  }
}
