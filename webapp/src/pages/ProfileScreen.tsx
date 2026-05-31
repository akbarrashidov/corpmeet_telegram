import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, useAuth, type User } from "@corpmeet/design/complex";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";
import { usePositions } from "../hooks/usePositions";
import { useWorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useUpdateMemberPosition } from "../hooks/useUpdateMemberPosition";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { useTranslation } from "../i18n";
import { LangToggle } from "../components/LangToggle";
import { PositionPicker } from "../components/PositionPicker";

const NAME_REGEX = /^[A-Z][a-z]+$/;

interface Props {
  onBack: () => void;
  onSaved: () => void;
}

export function ProfileScreen({ onBack, onSaved }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const inTg = !!getTelegram();

  const wsId = useCurrentWorkspaceId();
  const { data: wsDetail } = useWorkspaceDetail(wsId);
  const { data: positions } = usePositions(wsId);
  const updateMemberPosition = useUpdateMemberPosition(wsId ?? 0);

  // Я как member в текущем workspace
  const myMember = wsDetail?.members.find(
    (m) => m.user?.id === user?.id && m.status === "active",
  );

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [positionId, setPositionId] = useState<number | null>(
    myMember?.position_id ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useTgBackButton(onBack);

  function validate(): string | null {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!NAME_REGEX.test(fn)) {
      return t("register.error.first_name_format");
    }
    if (!NAME_REGEX.test(ln)) {
      return t("register.error.last_name_format");
    }
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      hapticError();
      setError(err);
      return;
    }
    setError(null);
    haptic();
    setSubmitting(true);
    try {
      const profileChanged =
        firstName.trim() !== (user?.first_name ?? "") ||
        lastName.trim() !== (user?.last_name ?? "");
      const positionChanged =
        myMember !== undefined && positionId !== (myMember.position_id ?? null);

      const tasks: Promise<unknown>[] = [];
      if (profileChanged) {
        tasks.push(
          apiClient.patch<User>("/api/v1/auth/me", {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          }),
        );
      }
      if (positionChanged && myMember) {
        tasks.push(
          updateMemberPosition.mutateAsync({
            memberId: myMember.id,
            positionId,
          }),
        );
      }
      await Promise.all(tasks);

      await queryClient.invalidateQueries({ queryKey: ["me"] });
      hapticSuccess();
      onSaved();
    } catch (e: any) {
      hapticError();
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? `[${status}] ${detail}`
          : t("profile.error.failed");
      setError(msg);
      setSubmitting(false);
    }
  }

  function handleHtmlSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  useTgMainButton({
    text: submitting ? "..." : t("profile.submit"),
    onClick: () => void submit(),
    disabled: submitting,
  });

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text)",
  };

  const showPositionSection = wsId !== null && myMember !== undefined;
  const hasPositions = (positions ?? []).length > 0;

  return (
    <form
      onSubmit={handleHtmlSubmit}
      className="min-h-screen flex flex-col p-6 gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">{t("profile.title")}</h1>
        <div className="flex items-center gap-2">
          <LangToggle />
          <button
            type="button"
            onClick={onBack}
            aria-label={t("common.close")}
            className="text-2xl leading-none px-2"
            style={{ color: "var(--text-sec)" }}
          >
            ✕
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm">{t("register.field.first_name")}</span>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={submitting}
          placeholder={t("register.placeholder.first_name")}
          className="rounded-lg p-3 outline-none"
          style={inputStyle}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">{t("register.field.last_name")}</span>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={submitting}
          placeholder={t("register.placeholder.last_name")}
          className="rounded-lg p-3 outline-none"
          style={inputStyle}
        />
      </label>

      {showPositionSection && (
        <div className="flex flex-col gap-2">
          <span className="text-sm">
            {t("profile.position.workspace_label", {
              name: wsDetail?.name ?? "",
            })}
          </span>
          {hasPositions ? (
            <PositionPicker
              positions={positions ?? []}
              value={positionId}
              onChange={setPositionId}
              disabled={submitting}
              ariaLabel={t("register.field.position")}
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-sec)" }}>
              {t("profile.position.empty_state")}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {!inTg && (
        <button
          type="submit"
          disabled={submitting}
          className="mt-auto rounded-lg p-3 font-semibold"
          style={{
            background: "var(--primary)",
            color: "white",
            opacity: submitting ? 0.5 : 1,
          }}
        >
          {submitting ? "..." : t("profile.submit")}
        </button>
      )}
    </form>
  );
}
