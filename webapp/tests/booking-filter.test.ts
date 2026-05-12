import { describe, expect, it } from "vitest";
import type { Booking, User } from "@corpmeet/design/complex";
import { filterInvited, filterMine, sortByStart, userFullName } from "../src/lib/booking-filter";

function makeUser(over: Partial<User> = {}): User {
  return {
    id: 1,
    telegram_id: 100,
    username: null,
    first_name: "Иван",
    last_name: "Иванов",
    role: "user",
    display_name: "Иван Иванов",
    position: null,
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

describe("filterInvited — match by fullName (backward compat)", () => {
  const user = makeUser({ first_name: "Иван", last_name: "Иванов" });

  it("returns bookings where user's full name is in guests", () => {
    const bookings = [
      makeBooking({ id: 1, guests: ["Иван Иванов", "Анна Петрова"] }),
      makeBooking({ id: 2, guests: ["Сидор Сидоров"] }),
    ];
    expect(filterInvited(bookings, user).map((b) => b.id)).toEqual([1]);
  });

  it("trims whitespace in guest entries", () => {
    const bookings = [makeBooking({ id: 1, guests: ["  Иван Иванов  "] })];
    expect(filterInvited(bookings, user)).toHaveLength(1);
  });

  it("matches case-insensitively", () => {
    const bookings = [makeBooking({ id: 1, guests: ["иван иванов"] })];
    expect(filterInvited(bookings, user)).toHaveLength(1);
  });

  it("doesn't match partial substrings", () => {
    const bookings = [makeBooking({ id: 1, guests: ["Иван Ивановский"] })];
    expect(filterInvited(bookings, user)).toEqual([]);
  });
});

describe("filterInvited — match by username (current backend behavior)", () => {
  const user = makeUser({
    first_name: "Sherzod",
    last_name: "Tojiev",
    username: "tmdvlpr",
    display_name: "Sherzod Tojiev",
  });

  it("returns bookings where username is in guests", () => {
    const bookings = [
      makeBooking({ id: 1, guests: ["tmdvlpr"] }),
      makeBooking({ id: 2, guests: ["other_user"] }),
    ];
    expect(filterInvited(bookings, user).map((b) => b.id)).toEqual([1]);
  });

  it("matches username case-insensitively", () => {
    const bookings = [makeBooking({ id: 1, guests: ["TMDVLPR"] })];
    expect(filterInvited(bookings, user)).toHaveLength(1);
  });

  it("trims whitespace around username", () => {
    const bookings = [makeBooking({ id: 1, guests: ["  tmdvlpr  "] })];
    expect(filterInvited(bookings, user)).toHaveLength(1);
  });

  it("recurring: matches sibling occurrences via group when guests stored as username", () => {
    const bookings = [
      makeBooking({
        id: 10,
        recurrence: "custom",
        recurrence_group_id: 42,
        guests: ["tmdvlpr"],
      }),
      makeBooking({
        id: 11,
        recurrence: "custom",
        recurrence_group_id: 42,
        guests: [],
        start_time: "2026-05-02T09:00:00+05:00",
      }),
      makeBooking({
        id: 12,
        recurrence: "custom",
        recurrence_group_id: 42,
        guests: [],
        start_time: "2026-05-03T09:00:00+05:00",
      }),
    ];
    expect(filterInvited(bookings, user).map((b) => b.id).sort()).toEqual([10, 11, 12]);
  });
});

describe("filterInvited — edge cases", () => {
  it("returns empty if user has neither full name nor username", () => {
    const incomplete = makeUser({ first_name: null, username: null });
    expect(filterInvited([makeBooking({ guests: ["Anything"] })], incomplete)).toEqual([]);
  });

  it("matches by username even if user has no first/last name", () => {
    const user = makeUser({ first_name: null, last_name: null, username: "tmdvlpr" });
    const bookings = [makeBooking({ id: 1, guests: ["tmdvlpr"] })];
    expect(filterInvited(bookings, user)).toHaveLength(1);
  });

  it("recurring: does not match other groups", () => {
    const user = makeUser({ first_name: "Иван", last_name: "Иванов" });
    const bookings = [
      makeBooking({
        id: 20,
        recurrence: "daily",
        recurrence_group_id: 1,
        guests: ["Сидор Сидоров"],
      }),
      makeBooking({
        id: 21,
        recurrence: "daily",
        recurrence_group_id: 1,
        guests: [],
      }),
    ];
    expect(filterInvited(bookings, user)).toEqual([]);
  });
});

describe("filterMine — match by id", () => {
  const user = makeUser({ id: 30, username: "tardigradi" });

  it("returns bookings where user.id === booking.user_id", () => {
    const bookings = [
      makeBooking({ id: 1, user_id: 30 }),
      makeBooking({ id: 2, user_id: 25 }),
      makeBooking({ id: 3, user_id: 30 }),
    ];
    expect(filterMine(bookings, user).map((b) => b.id)).toEqual([1, 3]);
  });

  it("returns empty when none owned and no username overlap", () => {
    const bookings = [
      makeBooking({ id: 1, user_id: 25, user: { ...makeUser(), id: 25, username: "other" } }),
      makeBooking({ id: 2, user_id: 99, user: { ...makeUser(), id: 99, username: "nobody" } }),
    ];
    expect(filterMine(bookings, user)).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(filterMine([], user)).toEqual([]);
  });
});

describe("filterMine — username fallback (defensive, Bug B)", () => {
  it("matches by username when id differs", () => {
    const user = makeUser({ id: 999, username: "tardigradi" });
    const bookings = [
      makeBooking({
        id: 1,
        user_id: 30,
        user: { ...makeUser(), id: 30, username: "tardigradi" },
      }),
      makeBooking({
        id: 2,
        user_id: 30,
        user: { ...makeUser(), id: 30, username: "other" },
      }),
    ];
    expect(filterMine(bookings, user).map((b) => b.id)).toEqual([1]);
  });

  it("username match is case-insensitive", () => {
    const user = makeUser({ id: 999, username: "Tardigradi" });
    const bookings = [
      makeBooking({
        id: 1,
        user_id: 30,
        user: { ...makeUser(), id: 30, username: "TARDIGRADI" },
      }),
    ];
    expect(filterMine(bookings, user)).toHaveLength(1);
  });

  it("id match still works when username is missing on user", () => {
    const user = makeUser({ id: 30, username: null });
    const bookings = [makeBooking({ id: 1, user_id: 30 })];
    expect(filterMine(bookings, user)).toHaveLength(1);
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
