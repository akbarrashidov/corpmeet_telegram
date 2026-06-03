import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@corpmeet/design/complex", async () => {
  const actual = await vi.importActual<typeof import("@corpmeet/design/complex")>(
    "@corpmeet/design/complex",
  );
  return { ...actual, useBookings: vi.fn() };
});

import { useBookings, type Booking } from "@corpmeet/design/complex";
import { useDayBookings } from "../src/hooks/useDayBookings";

const mockUseBookings = useBookings as unknown as ReturnType<typeof vi.fn>;

function makeBooking(id: number, workspaceId: number | null): Booking {
  return {
    id,
    title: `b${id}`,
    description: null,
    start_time: "2026-06-03T09:00:00Z",
    end_time: "2026-06-03T10:00:00Z",
    user_id: 1,
    user: { id: 1, telegram_id: 0, first_name: null, last_name: null, username: null, role: "user", display_name: "u" },
    created_at: "2026-06-03T00:00:00Z",
    guests: [],
    recurrence: "none",
    recurrence_until: null,
    recurrence_group_id: null,
    recurrence_days: [],
    workspace_id: workspaceId ?? undefined,
  } as unknown as Booking;
}

describe("useDayBookings", () => {
  beforeEach(() => {
    mockUseBookings.mockReset();
  });

  it("returns all bookings without filtering by workspace (cross-workspace timeline)", () => {
    const all = [makeBooking(1, 10), makeBooking(2, 20), makeBooking(3, 30)];
    mockUseBookings.mockReturnValue({ data: all, isLoading: false });
    const { result } = renderHook(() => useDayBookings("2026-06-03"));
    expect(result.current.data?.map((b) => b.id)).toEqual([1, 2, 3]);
  });

  it("passes date through to useBookings", () => {
    mockUseBookings.mockReturnValue({ data: [], isLoading: false });
    renderHook(() => useDayBookings("2026-06-15"));
    expect(mockUseBookings).toHaveBeenCalledWith("2026-06-15");
  });

  it("returns undefined data while loading (no filter side-effect)", () => {
    mockUseBookings.mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useDayBookings("2026-06-03"));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });
});
