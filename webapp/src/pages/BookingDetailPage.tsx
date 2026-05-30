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
  todayIso,
  isoToLocalInput,
} from "../lib/datetime";
import { useTgBackButton } from "../hooks/useTgBackButton";
import {
  useBookingGuestStatuses,
  type GuestRsvpStatus,
} from "../hooks/useBookingGuestStatuses";
import { useGuestRsvp } from "../hooks/useGuestRsvp";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { findNextFreeSlot } from "../lib/findNextFreeSlot";
import { useFormatDayMonth, useTranslation } from "../i18n";

interface Props {
  booking: Booking;
  onBack: () => void;
  onDeleted: () => void;
  onReschedule: (defaultStart: string, defaultEnd: string) => void;
}

/** Снимает ведущий @ и переводит в lowercase для сравнения имён гостей.
 *
 * После Тимуровой миграции `booking.guests` хранит имена с "@" префиксом —
 * `["@user1", "@user2"]`. `user.username` приходит без `@`. Нормализуем оба
 * к одному виду перед сравнением.
 */
function normalize(name: string): string {
  return name.trim().replace(/^@/, "").toLowerCase();
}

const STATUS_EMOJI: Record<GuestRsvpStatus, string> = {
  accepted: "🟢",
  declined: "🔴",
  pending: "⚪",
};

export function BookingDetailPage({
  booking,
  onBack,
  onDeleted,
  onReschedule,
}: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const formatDayMonth = useFormatDayMonth();
  const deleteBooking = useDeleteBooking();
  const guestStatuses = useBookingGuestStatuses(booking.id);
  const rsvp = useGuestRsvp(booking.id);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeclineOpen, setConfirmDeclineOpen] = useState(false);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOrganizer = user?.id === booking.user.id;
  const isReschedulable = isOrganizer && booking.recurrence === "none";
  const username = user?.username ? normalize(user.username) : null;
  const isInvited =
    !isOrganizer &&
    !!username &&
    booking.guests.some((g) => normalize(g) === username);

  // Текущий статус гостя — из real-time-poll'а или fallback pending.
  const myStatus: GuestRsvpStatus = (() => {
    if (!isInvited || !username || !guestStatuses.data) return "pending";
    const me = guestStatuses.data.find((g) => normalize(g.name) === username);
    return me?.status ?? "pending";
  })();

  // Map: normalized name → status (для отображения у организатора).
  const statusByName = new Map<string, GuestRsvpStatus>(
    (guestStatuses.data ?? []).map((g) => [normalize(g.name), g.status]),
  );

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
      setError(t("booking.error.cancel_failed"));
    }
  }

  async function handleAccept() {
    haptic();
    setError(null);
    try {
      await rsvp.mutateAsync("accepted");
      hapticSuccess();
    } catch {
      hapticError();
      setError(t("booking.error.rsvp_failed"));
    }
  }

  function openDecline() {
    haptic();
    setError(null);
    setConfirmDeclineOpen(true);
  }

  async function handleConfirmDecline() {
    setConfirmDeclineOpen(false);
    setError(null);
    try {
      await rsvp.mutateAsync("declined");
      hapticSuccess();
    } catch {
      hapticError();
      setError(t("booking.error.rsvp_failed"));
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
        setError(t("booking.error.no_slots_today"));
        return;
      }
      onReschedule(isoToLocalInput(plan.start), isoToLocalInput(plan.end));
    } catch {
      hapticError();
      setError(t("booking.error.slots_failed"));
    } finally {
      setRescheduleBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <PageHeader title={t("booking.title")} onBack={onBack} />

      <h2 className="font-heading text-2xl">{booking.title}</h2>

      <div className="flex flex-col gap-2 text-sm">
        <div>
          🕐 {dayLabel} · {formatTime(booking.start_time)} — {formatTime(booking.end_time)}
        </div>
        <div>👤 {organizerName}{isOrganizer && ` ${t("booking.organizer_self")}`}</div>
        {booking.guests.length > 0 && (
          <div className="flex flex-col gap-1">
            <div>👥 {t("booking.guests_label")}</div>
            <ul className="flex flex-col gap-1 pl-5">
              {booking.guests.map((rawName) => {
                const status = statusByName.get(normalize(rawName)) ?? "pending";
                return (
                  <li key={rawName}>
                    {STATUS_EMOJI[status]} {rawName}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {booking.description && (
        <div>
          <div className="text-sm mb-1" style={{ color: "var(--text-sec)" }}>
            {t("booking.description_label")}
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
            {t("booking.reschedule_button")}
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
            {t("booking.cancel_button")}
          </button>
        )}

        {isInvited && (
          <>
            <div
              className="text-sm text-center"
              style={{ color: "var(--text-sec)" }}
            >
              {myStatus === "accepted" && t("booking.my_status.accepted")}
              {myStatus === "declined" && t("booking.my_status.declined")}
              {myStatus === "pending" && t("booking.my_status.pending")}
            </div>
            <button
              type="button"
              onClick={handleAccept}
              disabled={rsvp.isPending}
              className="rounded-lg p-3 font-semibold"
              style={{
                background:
                  myStatus === "accepted"
                    ? "var(--success, #16a34a)"
                    : "var(--primary)",
                color: "white",
                opacity: rsvp.isPending ? 0.5 : 1,
              }}
            >
              {t("booking.accept_button")}
            </button>
            <button
              type="button"
              onClick={openDecline}
              disabled={rsvp.isPending}
              className="rounded-lg p-3 font-semibold"
              style={{
                background: "var(--danger)",
                color: "white",
                opacity: rsvp.isPending ? 0.5 : 1,
              }}
            >
              {t("booking.decline_button")}
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("booking.confirm.cancel_title")}
        body={t("booking.confirm.cancel_body", { title: booking.title })}
        confirmLabel={t("booking.confirm.cancel")}
        cancelLabel={t("common.back")}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ConfirmDialog
        open={confirmDeclineOpen}
        title={t("booking.confirm.decline_title")}
        body={t("booking.confirm.decline_body", { title: booking.title })}
        confirmLabel={t("booking.confirm.decline")}
        cancelLabel={t("common.back")}
        variant="danger"
        onConfirm={handleConfirmDecline}
        onCancel={() => setConfirmDeclineOpen(false)}
      />
    </div>
  );
}
