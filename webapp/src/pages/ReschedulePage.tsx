import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, useBookings, type Booking } from "@corpmeet/design/complex";
import { PageHeader } from "../components/PageHeader";
import { addDaysIso, localInputToIso, todayIso } from "../lib/datetime";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { useTranslation } from "../i18n";
import { DateTimePicker } from "../components/DateTimePicker";
import { RoomTimeline } from "../components/RoomTimeline";

interface Props {
  booking: Booking;
  defaultStart: string;
  defaultEnd: string;
  onBack: () => void;
  onSaved: () => void;
}

export function ReschedulePage({
  booking, defaultStart, defaultEnd, onBack, onSaved,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inTg = !!getTelegram();

  useTgBackButton(onBack);

  const dateForSlots = start.slice(0, 10);
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  const isToday = dateForSlots === today;
  const isTomorrow = dateForSlots === tomorrow;

  const dayBookings = useBookings(dateForSlots);
  const roomId = (booking as Booking & { room_id?: number | null }).room_id ?? null;
  const roomBookings = (dayBookings.data ?? []).filter(
    (b) => (b as Booking & { room_id?: number | null }).room_id === roomId,
  );

  function setDate(newDate: string) {
    haptic();
    const startTime = start.split("T")[1] ?? "00:00";
    const endTime = end.split("T")[1] ?? "00:00";
    setStart(`${newDate}T${startTime}`);
    setEnd(`${newDate}T${endTime}`);
  }

  function handleTimelineTap(newStart: string, newEnd: string) {
    setStart(newStart);
    setEnd(newEnd);
  }

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

  const dayBtnInactive = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };
  const dayBtnActive = {
    background: "var(--primary)",
    color: "white",
    border: "1px solid transparent",
  };

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <PageHeader title={t("reschedule.title")} onBack={onBack} />

      <h2 className="font-heading text-2xl">{booking.title}</h2>

      <form onSubmit={handleHtmlSubmit} className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDate(today)}
            className="flex-1 rounded-lg p-2.5 font-medium text-sm"
            style={isToday ? dayBtnActive : dayBtnInactive}
          >
            {t("reschedule.day.today")}
          </button>
          <button
            type="button"
            onClick={() => setDate(tomorrow)}
            className="flex-1 rounded-lg p-2.5 font-medium text-sm"
            style={isTomorrow ? dayBtnActive : dayBtnInactive}
          >
            {t("reschedule.day.tomorrow")}
          </button>
        </div>

        {roomId !== null && (
          <RoomTimeline
            bookings={roomBookings}
            date={dateForSlots}
            selectedStart={start}
            selectedEnd={end}
            onTap={handleTimelineTap}
          />
        )}

        <DateTimePicker
          label={t("create.field.start")}
          value={start}
          onChange={setStart}
        />

        <DateTimePicker
          label={t("create.field.end")}
          value={end}
          onChange={setEnd}
        />

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
