import type { Booking } from "@corpmeet/design/complex";
import { formatTime } from "../lib/datetime";
import { useTranslation } from "../i18n";

interface Props {
  booking: Booking;
  invitedBadge?: boolean;
  onClick?: () => void;
}

export function BookingCard({ booking, invitedBadge, onClick }: Props) {
  const { t } = useTranslation();
  const organizerName =
    booking.user.display_name ??
    [booking.user.first_name, booking.user.last_name].filter(Boolean).join(" ");

  return (
    <article
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className="rounded-xl p-4 flex flex-col gap-1 cursor-pointer"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div className="text-sm font-medium" style={{ color: "var(--text-sec)" }}>
        {formatTime(booking.start_time)} — {formatTime(booking.end_time)}
      </div>
      <h3 className="font-semibold text-base">{booking.title}</h3>
      <div className="text-sm" style={{ color: "var(--text-sec)" }}>
        👤 {organizerName}
      </div>
      {invitedBadge && (
        <div
          className="mt-2 inline-flex self-start text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          {t("booking.guest_badge")}
        </div>
      )}
    </article>
  );
}
