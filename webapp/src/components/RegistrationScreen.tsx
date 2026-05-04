import { FormEvent, useState } from "react";
import { getTelegram } from "../lib/telegram";

interface Props {
  onSubmit: (firstName: string, lastName: string) => Promise<void>;
}

export function RegistrationScreen({ onSubmit }: Props) {
  const tg = getTelegram();
  const tgUser = tg?.initDataUnsafe?.user;

  const [firstName, setFirstName] = useState(tgUser?.first_name ?? "");
  const [lastName, setLastName] = useState(tgUser?.last_name ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setError("Заполни оба поля");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(fn, ln);
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

  return (
    <form
      onSubmit={handleSubmit}
      className="min-h-screen flex flex-col p-6 gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <h1 className="font-heading text-2xl">Регистрация</h1>
      <p style={{ color: "var(--text-sec)" }}>
        Чтобы пользоваться CorpMeet, укажи имя и фамилию.
      </p>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Имя</span>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={submitting}
          className="rounded-lg p-3 outline-none"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            color: "var(--text)",
          }}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm">Фамилия</span>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={submitting}
          className="rounded-lg p-3 outline-none"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            color: "var(--text)",
          }}
        />
      </label>

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
        {submitting ? "..." : "Зарегистрироваться"}
      </button>
    </form>
  );
}
