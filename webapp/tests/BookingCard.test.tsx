import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Booking } from "@corpmeet/design/complex";
import { BookingCard } from "../src/components/BookingCard";

function makeBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: 1,
    title: "Утренняя планёрка",
    description: null,
    start_time: "2026-05-01T09:00:00+05:00",
    end_time: "2026-05-01T10:00:00+05:00",
    user_id: 99,
    user: {
      id: 99,
      telegram_id: 100,
      username: null,
      first_name: "Иван",
      last_name: "Иванов",
      role: "user",
      display_name: "Иван Иванов",
    },
    created_at: "",
    guests: [],
    recurrence: "none",
    recurrence_until: null,
    recurrence_group_id: null,
    recurrence_days: [],
    ...over,
  };
}

describe("BookingCard", () => {
  it("renders title, time range, and organizer", () => {
    render(<BookingCard booking={makeBooking()} />);
    expect(screen.getByText("Утренняя планёрка")).toBeInTheDocument();
    expect(screen.getByText(/09:00 — 10:00/)).toBeInTheDocument();
    expect(screen.getByText(/Иван Иванов/)).toBeInTheDocument();
  });

  it("does not show invited badge by default", () => {
    render(<BookingCard booking={makeBooking()} />);
    expect(screen.queryByText("Ты в гостях")).not.toBeInTheDocument();
  });

  it("shows invited badge when invitedBadge=true", () => {
    render(<BookingCard booking={makeBooking()} invitedBadge />);
    expect(screen.getByText("Ты в гостях")).toBeInTheDocument();
  });
});
