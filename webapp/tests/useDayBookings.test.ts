import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@corpmeet/design/complex", async () => {
  const actual = await vi.importActual<typeof import("@corpmeet/design/complex")>(
    "@corpmeet/design/complex",
  );
  return { ...actual, useBookings: vi.fn() };
});

vi.mock("../src/lib/currentWorkspace", () => ({
  useCurrentWorkspaceId: vi.fn(),
}));

import { useBookings, type Booking } from "@corpmeet/design/complex";
import { useCurrentWorkspaceId } from "../src/lib/currentWorkspace";
import { useDayBookings } from "../src/hooks/useDayBookings";

const mockUseBookings = useBookings as unknown as ReturnType<typeof vi.fn>;
const mockUseWs = useCurrentWorkspaceId as unknown as ReturnType<typeof vi.fn>;

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
    mockUseWs.mockReset();
  });

  it("filters bookings to the active workspace", () => {
    mockUseWs.mockReturnValue(10);
    mockUseBookings.mockReturnValue({
      data: [makeBooking(1, 10), makeBooking(2, 20), makeBooking(3, 10)],
      isLoading: false,
    });
    const { result } = renderHook(() => useDayBookings("2026-06-03"));
    expect(result.current.data?.map((b) => b.id)).toEqual([1, 3]);
  });

  it("returns all when workspace id is null", () => {
    mockUseWs.mockReturnValue(null);
    mockUseBookings.mockReturnValue({
      data: [makeBooking(1, 10), makeBooking(2, 20)],
      isLoading: false,
    });
    const { result } = renderHook(() => useDayBookings("2026-06-03"));
    expect(result.current.data?.map((b) => b.id)).toEqual([1, 2]);
  });

  it("returns undefined while loading", () => {
    mockUseWs.mockReturnValue(10);
    mockUseBookings.mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useDayBookings("2026-06-03"));
    expect(result.current.data).toBeUndefined();
  });
});
