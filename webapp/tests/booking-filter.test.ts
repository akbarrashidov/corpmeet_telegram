import { describe, expect, it } from "vitest";
import type { Booking, User } from "@corpmeet/design/complex";
import { filterInvited, sortByStart, userFullName } from "../src/lib/booking-filter";

function makeUser(over: Partial<User> = {}): User {
  return {
    id: 1,
    telegram_id: 100,
    username: null,
    first_name: "Иван",
    last_name: "Иванов",
    role: "user",
    display_name: "Иван Иванов",
    ...over,
  };
}

function makeBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: 1,
    title: "Test",
    description: null,
    start_time: "2026-05-01T09:00:00+05:00",
    end_time: "2026-05-01T10:00:00+05:00",
    user_id: 99,
    user: { ...makeUser(), id: 99 },
    created_at: "",
    guests: [],
    recurrence: "none",
    recurrence_until: null,
    recurrence_group_id: null,
    recurrence_days: [],
    ...over,
  };
}

describe("userFullName", () => {
  it("joins first + last with single space", () => {
    expect(userFullName({ first_name: "Иван", last_name: "Иванов" })).toBe("Иван Иванов");
  });

  it("returns null if first_name missing", () => {
    expect(userFullName({ first_name: null, last_name: "Иванов" })).toBeNull();
  });

  it("returns null if last_name missing", () => {
    expect(userFullName({ first_name: "Иван", last_name: null })).toBeNull();
  });
});

describe("filterInvited", () => {
  const user = makeUser({ first_name: "Иван", last_name: "Иванов" });

  it("returns bookings where user's full name is in guests", () => {
    const bookings = [
      makeBooking({ id: 1, guests: ["Иван Иванов", "Анна Петрова"] }),
      makeBooking({ id: 2, guests: ["Сидор Сидоров"] }),
    ];
    const result = filterInvited(bookings, user);
    expect(result.map((b) => b.id)).toEqual([1]);
  });

  it("trims whitespace in guest entries", () => {
    const bookings = [makeBooking({ id: 1, guests: ["  Иван Иванов  "] })];
    expect(filterInvited(bookings, user)).toHaveLength(1);
  });

  it("returns empty if user lacks first/last name", () => {
    const incomplete = makeUser({ first_name: null });
    expect(filterInvited([makeBooking({ guests: ["Anything"] })], incomplete)).toEqual([]);
  });

  it("doesn't match partial substrings", () => {
    const bookings = [makeBooking({ id: 1, guests: ["Иван Ивановский"] })];
    expect(filterInvited(bookings, user)).toEqual([]);
  });
});

describe("sortByStart", () => {
  it("sorts by start_time ascending", () => {
    const bookings = [
      makeBooking({ id: 2, start_time: "2026-05-01T11:00:00+05:00" }),
      makeBooking({ id: 1, start_time: "2026-05-01T09:00:00+05:00" }),
      makeBooking({ id: 3, start_time: "2026-05-01T15:00:00+05:00" }),
    ];
    expect(sortByStart(bookings).map((b) => b.id)).toEqual([1, 2, 3]);
  });

  it("does not mutate input", () => {
    const bookings = [
      makeBooking({ id: 2, start_time: "2026-05-01T11:00:00+05:00" }),
      makeBooking({ id: 1, start_time: "2026-05-01T09:00:00+05:00" }),
    ];
    const before = bookings.map((b) => b.id);
    sortByStart(bookings);
    expect(bookings.map((b) => b.id)).toEqual(before);
  });
});
