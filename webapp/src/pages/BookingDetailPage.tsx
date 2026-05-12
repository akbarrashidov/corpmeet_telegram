import { useState } from "react";
import {
  apiClient,
  useAuth,
  useDeleteBooking,
  type Booking,
  type SlotResponse,
} from "@corpmeet/design/complex";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  formatTime,
  todayIso,
  isoToLocalInput,
} from "../lib/datetime";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { findNextFreeSlot } from "../lib/findNextFreeSlot";
import { useFormatDayMonth, useTranslation } from "../i18n";

interface Props {
  booking: Booking;
  onBack: () => void;
  onDeleted: () => void;
  onReschedule: (defaultStart: string, defaultEnd: string) => void;
}

type DeclineMode = "one" | "series";

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
  const queryClient = useQueryClient();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeclineOpen, setConfirmDeclineOpen] = useState(false);
  const [seriesChoiceOpen, setSeriesChoiceOpen] = useState(false);
  const [declineBusy, setDeclineBusy] = useState(false);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOrganizer = user?.id === booking.user.id;
  const isReschedulable = isOrganizer && booking.recurrence === "none";
  const isSeries =
    booking.recurrence !== "none" && booking.recurrence_group_id !== null;
  const username = user?.username?.toLowerCase() ?? null;
  const isInvited =
    !isOrganizer &&
    !!username &&
    booking.guests.some((g) => g.trim().toLowerCase() === username);

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

  function openDecline() {
    haptic();
    setError(null);
    if (isSeries) setSeriesChoiceOpen(true);
    else setConfirmDeclineOpen(true);
  }

  async function patchRemoveSelf(b: Booking): Promise<void> {
    const nextGuests = b.guests.filter(
      (g) => g.trim().toLowerCase() !== username,
    );
    await apiClient.patch(`/api/v1/bookings/${b.id}`, {
      guests: nextGuests,
    });
  }

  async function doDecline(mode: DeclineMode) {
    if (!username) return;
    setSeriesChoiceOpen(false);
    setConfirmDeclineOpen(false);
    setDeclineBusy(true);
    setError(null);
    try {
      if (mode === "series" && booking.recurrence_group_id !== null) {
        const cached =
          queryClient.getQueryData<Booking[]>(["bookings", "active"]) ?? [];
        const siblings = cached.filter(
          (b) =>
            b.recurrence_group_id === booking.recurrence_group_id &&
            b.guests.some((g) => g.trim().toLowerCase() === username),
        );
        const targets = siblings.length > 0 ? siblings : [booking];
        const results = await Promise.allSettled(targets.map(patchRemoveSelf));
        const failed = results.filter((r) => r.status === "rejected").length;
        await queryClient.invalidateQueries({ queryKey: ["bookings", "active"] });
        if (failed > 0) {
          hapticError();
          setError(t("booking.error.decline_partial"));
          return;
        }
      } else {
        await patchRemoveSelf(booking);
        await queryClient.invalidateQueries({ queryKey: ["bookings", "active"] });
      }
      hapticSuccess();
      onDeleted();
    } catch {
      hapticError();
      setError(t("booking.error.decline_failed"));
    } finally {
      setDeclineBusy(false);
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
          <div>👥 {booking.guests.join(", ")}</div>
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
          <button
            type="button"
            onClick={openDecline}
            disabled={declineBusy}
            className="rounded-lg p-3 font-semibold"
            style={{
              background: "var(--danger)",
              color: "white",
              opacity: declineBusy ? 0.5 : 1,
            }}
          >
            {t("booking.decline_button")}
          </button>
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
        onConfirm={() => void doDecline("one")}
        onCancel={() => setConfirmDeclineOpen(false)}
      />

      {seriesChoiceOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center p-6 z-50"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setSeriesChoiceOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl p-5 w-full max-w-sm flex flex-col gap-3"
            style={{
              background: "var(--modal)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            <h2 className="font-semibold text-lg">
              {t("booking.series_choice.title")}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-sec)" }}>
              {t("booking.series_choice.body")}
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={() => void doDecline("one")}
                className="rounded-lg p-3 font-semibold"
                style={{ background: "var(--danger)", color: "white" }}
              >
                {t("booking.series_choice.one")}
              </button>
              <button
                type="button"
                onClick={() => void doDecline("series")}
                className="rounded-lg p-3 font-semibold"
                style={{ background: "var(--danger)", color: "white" }}
              >
                {t("booking.series_choice.series")}
              </button>
              <button
                type="button"
                onClick={() => setSeriesChoiceOpen(false)}
                className="rounded-lg p-2.5 font-medium"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
