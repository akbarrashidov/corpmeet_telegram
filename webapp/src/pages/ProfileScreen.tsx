import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, useAuth, type User } from "@corpmeet/design/complex";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

const POSITION_OPTIONS = [
  "Начальник департамента/отдела",
  "PM",
  "Аналитик",
  "Программист и др.",
  "Дизайнер",
] as const;

const NAME_REGEX = /^[A-Z][a-z]+$/;

interface Props {
  onBack: () => void;
  onSaved: () => void;
}

export function ProfileScreen({ onBack, onSaved }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inTg = !!getTelegram();

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [position, setPosition] = useState<string | null>(user?.position ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useTgBackButton(onBack);

  function validate(): string | null {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!NAME_REGEX.test(fn)) {
      return "Имя — латиница, с большой буквы (например, Alisher).";
    }
    if (!NAME_REGEX.test(ln)) {
      return "Фамилия — латиница, с большой буквы (например, Rakhimov).";
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
      await apiClient.patch<User>("/api/v1/auth/me", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        position,
      });
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
          : "Не удалось сохранить. Попробуй ещё.";
      setError(msg);
      setSubmitting(false);
    }
  }

  function handleHtmlSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  useTgMainButton({
    text: submitting ? "..." : "Сохранить",
    onClick: () => void submit(),
    disabled: submitting,
  });

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text)",
  };

  const positionItems: { value: string | null; label: string }[] = [
    { value: null, label: "Не указана" },
    ...POSITION_OPTIONS.map((p) => ({ value: p, label: p })),
  ];

  return (
    <form
      onSubmit={handleHtmlSubmit}
      className="min-h-screen flex flex-col p-6 gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Редактировать профиль</h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="Закрыть"
          className="text-2xl leading-none px-2"
          style={{ color: "var(--text-sec)" }}
        >
          ✕
        </button>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Имя</span>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={submitting}
          placeholder="Alisher"
          className="rounded-lg p-3 outline-none"
          style={inputStyle}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Фамилия</span>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={submitting}
          placeholder="Rakhimov"
          className="rounded-lg p-3 outline-none"
          style={inputStyle}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm">Должность</legend>
        <div className="flex flex-col gap-2">
          {positionItems.map((item) => {
            const selected = position === item.value;
            return (
              <button
                key={item.value ?? "__none__"}
                type="button"
                onClick={() => setPosition(item.value)}
                disabled={submitting}
                aria-pressed={selected}
                className="rounded-lg px-3 py-2 text-sm font-medium text-left transition"
                style={{
                  background: selected ? "var(--primary)" : "var(--input-bg)",
                  color: selected ? "white" : "var(--text)",
                  border: `1px solid ${
                    selected ? "var(--primary)" : "var(--input-border)"
                  }`,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>

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
          {submitting ? "..." : "Сохранить"}
        </button>
      )}
    </form>
  );
}
