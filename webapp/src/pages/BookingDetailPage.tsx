import { useState } from "react";
import {
  apiClient,
  useAuth,
  useDeleteBooking,
  type Booking,
  type SlotResponse,
} from "@corpmeet/design/complex";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  formatTime,
  formatDayMonth,
  todayIso,
  isoToLocalInput,
} from "../lib/datetime";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { findNextFreeSlot } from "../lib/findNextFreeSlot";

interface Props {
  booking: Booking;
  onBack: () => void;
  onDeleted: () => void;
  onReschedule: (defaultStart: string, defaultEnd: string) => void;
}

export function BookingDetailPage({
  booking,
  onBack,
  onDeleted,
  onReschedule,
}: Props) {
  const { user } = useAuth();
  const deleteBooking = useDeleteBooking();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOrganizer = user?.id === booking.user.id;
  const isReschedulable = isOrganizer && booking.recurrence === "none";
  const dayLabel = formatDayMonth(booking.start_time.split("T")[0]);
  const organizerName =
    booking.user.display_name ??
    [booking.user.first_name, booking.user.last_name].filter(Boolean).join(" ");

  useTgBackButton(onBack);

  function openConfirmDelete() {
    haptic();
    setConfirmDeleteOpen(true);
  }

  async function handleConfirmDelete() {
    setConfirmDeleteOpen(false);
    setError(null);
    try {
      await deleteBooking.mutateAsync({ id: booking.id });
      hapticSuccess();
      onDeleted();
    } catch {
      hapticError();
      setError("Не удалось отменить. Попробуй ещё.");
    }
  }

  async function handleClickReschedule() {
    if (rescheduleBusy) return;
    haptic();
    setError(null);
    setRescheduleBusy(true);
    try {
      const { data: slots } = await apiClient.get<SlotResponse[]>(
        "/api/v1/slots",
        { params: { date: todayIso() } }
      );
      const originalDurationMs =
        new Date(booking.end_time).getTime() -
        new Date(booking.start_time).getTime();
      const plan = findNextFreeSlot(slots, originalDurationMs);
      if (!plan) {
        hapticError();
        setError("На сегодня нет свободных слотов :(");
        return;
      }
      onReschedule(isoToLocalInput(plan.start), isoToLocalInput(plan.end));
    } catch {
      hapticError();
      setError("Не удалось получить занятость. Попробуй ещё.");
    } finally {
      setRescheduleBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <PageHeader title="Встреча" onBack={onBack} />

      <h2 className="font-heading text-2xl">{booking.title}</h2>

      <div className="flex flex-col gap-2 text-sm">
        <div>
          🕐 {dayLabel} · {formatTime(booking.start_time)} — {formatTime(booking.end_time)}
        </div>
        <div>👤 {organizerName}{isOrganizer && " (это ты)"}</div>
        {booking.guests.length > 0 && (
          <div>👥 {booking.guests.join(", ")}</div>
        )}
      </div>

      {booking.description && (
        <div>
          <div className="text-sm mb-1" style={{ color: "var(--text-sec)" }}>
            Описание
          </div>
          <p>{booking.description}</p>
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {isReschedulable && (
          <button
            type="button"
            onClick={handleClickReschedule}
            disabled={rescheduleBusy}
            className="rounded-lg p-3 font-semibold"
            style={{
              background: "var(--primary)",
              color: "white",
              opacity: rescheduleBusy ? 0.5 : 1,
            }}
          >
            Перенести встречу
          </button>
        )}

        {isOrganizer && (
          <button
            type="button"
            onClick={openConfirmDelete}
            disabled={deleteBooking.isPending}
            className="rounded-lg p-3 font-semibold"
            style={{
              background: "var(--danger)",
              color: "white",
              opacity: deleteBooking.isPending ? 0.5 : 1,
            }}
          >
            Отменить встречу
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Отменить встречу?"
        body={`«${booking.title}» — встреча будет удалена.`}
        confirmLabel="Отменить"
        cancelLabel="Назад"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
