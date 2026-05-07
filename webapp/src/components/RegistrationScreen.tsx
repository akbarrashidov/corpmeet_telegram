import { FormEvent, useState } from "react";
import { useTranslation, type TranslationKey } from "../i18n";
import { LangToggle } from "./LangToggle";

const POSITION_OPTIONS: { apiValue: string; labelKey: TranslationKey }[] = [
  { apiValue: "Начальник департамента/отдела", labelKey: "position.label.heads" },
  { apiValue: "PM", labelKey: "position.label.pm" },
  { apiValue: "Аналитик", labelKey: "position.label.analyst" },
  { apiValue: "Программист и др.", labelKey: "position.label.dev" },
  { apiValue: "Дизайнер", labelKey: "position.label.designer" },
];

const NAME_REGEX = /^[A-Z][a-z]+$/;

interface Props {
  defaultFirstName?: string;
  defaultLastName?: string;
  defaultPosition?: string | null;
  onSubmit: (firstName: string, lastName: string, position: string) => Promise<void>;
}

export function RegistrationScreen({
  defaultFirstName = "",
  defaultLastName = "",
  defaultPosition = null,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [position, setPosition] = useState<string | null>(defaultPosition);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!NAME_REGEX.test(fn)) return t("register.error.first_name_format");
    if (!NAME_REGEX.test(ln)) return t("register.error.last_name_format");
    if (!position) return t("register.error.position_required");
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(firstName.trim(), lastName.trim(), position!);
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      const detail = data?.detail;
      let msg: string;
      if (typeof detail === "string") {
        msg = `[${status}] ${detail}`;
      } else if (data !== undefined) {
        msg = `[${status}] ${JSON.stringify(data).slice(0, 200)}`;
      } else {
        msg = `Сеть: ${e?.message ?? "unknown"}`;
      }
      setError(msg);
      setSubmitting(false);
    }
  }

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text)",
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="min-h-screen flex flex-col p-6 gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 flex-1">
          <h1 className="font-heading text-2xl">{t("register.title")}</h1>
          <p style={{ color: "var(--text-sec)" }}>{t("register.subtitle")}</p>
        </div>
        <LangToggle />
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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm">{t("register.field.position")}</legend>
        <div className="flex flex-wrap gap-2">
          {POSITION_OPTIONS.map((opt) => {
            const selected = position === opt.apiValue;
            return (
              <button
                key={opt.apiValue}
                type="button"
                onClick={() => setPosition(opt.apiValue)}
                disabled={submitting}
                aria-pressed={selected}
                className="px-3 py-2 rounded-full text-sm font-medium transition"
                style={{
                  background: selected ? "var(--primary)" : "var(--input-bg)",
                  color: selected ? "white" : "var(--text)",
                  border: `1px solid ${
                    selected ? "var(--primary)" : "var(--input-border)"
                  }`,
                }}
              >
                {t(opt.labelKey)}
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
        {submitting ? "..." : t("register.submit")}
      </button>
    </form>
  );
}
