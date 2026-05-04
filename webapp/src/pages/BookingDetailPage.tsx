import { useState } from "react";
import { useAuth, useDeleteBooking, type Booking } from "@corpmeet/design/complex";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatTime, formatDayMonth } from "../lib/datetime";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  booking: Booking;
  onBack: () => void;
  onDeleted: () => void;
}

export function BookingDetailPage({ booking, onBack, onDeleted }: Props) {
  const { user } = useAuth();
  const deleteBooking = useDeleteBooking();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inTg = !!getTelegram();

  const isOrganizer = user?.id === booking.user.id;
  const dayLabel = formatDayMonth(booking.start_time.split("T")[0]);
  const organizerName =
    booking.user.display_name ??
    [booking.user.first_name, booking.user.last_name].filter(Boolean).join(" ");

  useTgBackButton(onBack);

  function openConfirm() {
    haptic();
    setConfirmOpen(true);
  }

  // TG MainButton "Отменить встречу" — только для организатора
  useTgMainButton({
    text: "Отменить встречу",
    onClick: openConfirm,
    visible: isOrganizer,
    disabled: deleteBooking.isPending,
  });

  async function handleConfirmDelete() {
    setConfirmOpen(false);
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

      {isOrganizer && !inTg && (
        <button
          type="button"
          onClick={openConfirm}
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
        open={confirmOpen}
        title="Отменить встречу?"
        body={`«${booking.title}» — встреча будет удалена.`}
        confirmLabel="Отменить"
        cancelLabel="Назад"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
