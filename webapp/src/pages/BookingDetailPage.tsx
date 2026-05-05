import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  useAuth,
  useDeleteBooking,
  type Booking,
  type SlotResponse,
} from "@corpmeet/design/complex";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatTime, formatDayMonth, todayIso } from "../lib/datetime";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import {
  findNextFreeSlot,
  type ReschedulePlan,
} from "../lib/findNextFreeSlot";

interface Props {
  booking: Booking;
  onBack: () => void;
  onDeleted: () => void;
}

export function BookingDetailPage({ booking, onBack, onDeleted }: Props) {
  const { user } = useAuth();
  const deleteBooking = useDeleteBooking();
  const queryClient = useQueryClient();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [proposedSlot, setProposedSlot] = useState<ReschedulePlan | null>(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inTg = !!getTelegram();
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

  // TG MainButton "Отменить встречу" — только для организатора
  useTgMainButton({
    text: "Отменить встречу",
    onClick: openConfirmDelete,
    visible: isOrganizer,
    disabled: deleteBooking.isPending,
  });

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
        setError("Нет свободных слотов сегодня.");
        return;
      }
      setProposedSlot(plan);
    } catch {
      hapticError();
      setError("Не удалось получить занятость. Попробуй ещё.");
    } finally {
      setRescheduleBusy(false);
    }
  }

  async function handleConfirmReschedule() {
    if (!proposedSlot) return;
    setRescheduleBusy(true);
    setError(null);
    try {
      await apiClient.patch(`/api/v1/bookings/${booking.id}`, {
        start_time: proposedSlot.start,
        end_time: proposedSlot.end,
      });
      hapticSuccess();
      setProposedSlot(null);
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      onBack();
    } catch {
      hapticError();
      setError("Не удалось перенести. Попробуй ещё.");
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

      {isReschedulable && (
        <button
          type="button"
          onClick={handleClickReschedule}
          disabled={rescheduleBusy}
          className="rounded-lg p-3 font-semibold"
          style={{
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            opacity: rescheduleBusy ? 0.5 : 1,
          }}
        >
          Перенести на ближайшее свободное
        </button>
      )}

      {isOrganizer && !inTg && (
        <button
          type="button"
          onClick={openConfirmDelete}
          disabled={deleteBooking.isPending}
          className="mt-auto rounded-lg p-3 font-semibold"
          style={{
            background: "var(--danger)",
            color: "white",
            opacity: deleteBooking.isPending ? 0.5 : 1,
          }}
        >
          Отменить встречу
        </button>
      )}

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

      <ConfirmDialog
        open={proposedSlot !== null}
        title="Перенести встречу?"
        body={
          proposedSlot && (
            <>
              «{booking.title}» — на{" "}
              <strong>
                {formatTime(proposedSlot.start)}–{formatTime(proposedSlot.end)}
              </strong>
              .
            </>
          )
        }
        confirmLabel="Перенести"
        cancelLabel="Назад"
        onConfirm={handleConfirmReschedule}
        onCancel={() => setProposedSlot(null)}
      />
    </div>
  );
}
