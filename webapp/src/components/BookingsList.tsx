import type { Booking } from "@corpmeet/design/complex";
import { BookingCard } from "./BookingCard";

interface Props {
  bookings: Booking[] | undefined;
  isLoading: boolean;
  emptyMessage: string;
  invitedBadge?: boolean;
  onSelect?: (booking: Booking) => void;
}

export function BookingsList({
  bookings,
  isLoading,
  emptyMessage,
  invitedBadge,
  onSelect,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl h-24"
            style={{ background: "var(--skeleton)" }}
            data-testid="booking-skeleton"
          />
        ))}
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((b) => (
        <BookingCard
          key={b.id}
          booking={b}
          invitedBadge={invitedBadge}
          onClick={onSelect ? () => onSelect(b) : undefined}
        />
      ))}
    </div>
  );
}
