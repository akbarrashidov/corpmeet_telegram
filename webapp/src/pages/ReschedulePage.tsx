import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, type Booking } from "@corpmeet/design/complex";
import { PageHeader } from "../components/PageHeader";
import { localInputToIso } from "../lib/datetime";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { useTranslation } from "../i18n";

interface Props {
  booking: Booking;
  defaultStart: string;
  defaultEnd: string;
  onBack: () => void;
  onSaved: () => void;
}

export function ReschedulePage({
  booking,
  defaultStart,
  defaultEnd,
  onBack,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inTg = !!getTelegram();

  useTgBackButton(onBack);

  async function submit() {
    if (start >= end) {
      hapticError();
      setError(t("create.error.end_after_start"));
      return;
    }
    setError(null);
    haptic();
    setBusy(true);
    try {
      await apiClient.patch(`/api/v1/bookings/${booking.id}`, {
        start_time: localInputToIso(start),
        end_time: localInputToIso(end),
      });
      hapticSuccess();
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      onSaved();
    } catch {
      hapticError();
      setError(t("reschedule.error.failed"));
    } finally {
      setBusy(false);
    }
  }

  function handleHtmlSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  useTgMainButton({
    text: busy ? "..." : t("reschedule.submit_short"),
    onClick: () => void submit(),
    disabled: busy,
  });

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text)",
  };

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <PageHeader title={t("reschedule.title")} onBack={onBack} />

      <h2 className="font-heading text-2xl">{booking.title}</h2>

      <form onSubmit={handleHtmlSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm">{t("create.field.start")}</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={busy}
            className="rounded-lg p-3 outline-none"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm">{t("create.field.end")}</span>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={busy}
            className="rounded-lg p-3 outline-none"
            style={inputStyle}
          />
        </label>

        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {!inTg && (
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-lg p-3 font-semibold"
            style={{
              background: "var(--primary)",
              color: "white",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? "..." : t("reschedule.submit_short")}
          </button>
        )}
      </form>
    </div>
  );
}
