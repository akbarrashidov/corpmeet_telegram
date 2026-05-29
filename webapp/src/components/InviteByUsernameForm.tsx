import { useState } from "react";
import { useInviteMember } from "../hooks/useInviteMember";
import { useGenerateInviteLink } from "../hooks/useGenerateInviteLink";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  workspaceId: number;
}

/**
 * Форма приглашения по @username + кнопка анонимной ссылки.
 *
 * После успеха результат отображается в pending-list workspace (через
 * invalidateQueries в хуках — pending member появится в `useWorkspaceDetail`),
 * там же можно скопировать deep_link.
 */
export function InviteByUsernameForm({ workspaceId }: Props) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invite = useInviteMember(workspaceId);
  const generateLink = useGenerateInviteLink(workspaceId);

  async function handleInvite() {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) {
      hapticError();
      setError(t("members_section.invite.error.required"));
      return;
    }
    setError(null);
    haptic();
    try {
      await invite.mutateAsync(clean);
      hapticSuccess();
      setUsername("");
    } catch (e: any) {
      hapticError();
      const status = e?.response?.status;
      if (status === 409) {
        setError(t("members_section.invite.error.already_member"));
      } else if (status === 404) {
        setError(t("members_section.invite.error.not_found"));
      } else {
        setError(t("members_section.invite.error.failed"));
      }
    }
  }

  async function handleGenerateAnon() {
    haptic();
    try {
      await generateLink.mutateAsync();
      hapticSuccess();
    } catch {
      hapticError();
      setError(t("members_section.invite.error.failed"));
    }
  }

  const busy = invite.isPending || generateLink.isPending;
  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text)",
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm">{t("members_section.invite.label")}</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("members_section.invite.placeholder")}
          disabled={busy}
          className="w-full rounded-lg p-3 outline-none"
          style={inputStyle}
        />
      </label>

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleInvite}
          disabled={busy}
          className="rounded-lg p-3 font-semibold"
          style={{
            background: "var(--primary)",
            color: "white",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {invite.isPending ? "..." : t("members_section.invite.submit")}
        </button>

        <button
          type="button"
          onClick={handleGenerateAnon}
          disabled={busy}
          className="rounded-lg p-2.5 font-medium text-sm"
          style={{
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {generateLink.isPending ? "..." : t("members_section.invite.generate_anon")}
        </button>
      </div>
    </div>
  );
}
