import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  useAuth: vi.fn(),
  useDeleteBooking: vi.fn(),
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import {
  apiClient,
  useAuth,
  useDeleteBooking,
} from "@corpmeet/design/complex";
import type { Booking } from "@corpmeet/design/complex";
import { BookingDetailPage } from "../src/pages/BookingDetailPage";

const baseUser = {
  id: 1,
  telegram_id: 100,
  username: null,
  first_name: "Иван",
  last_name: "Иванов",
  role: "user" as const,
  display_name: "Иван Иванов",
};

const baseBooking: Booking = {
  id: 5,
  title: "Демо",
  description: "Текст описания",
  start_time: "2026-05-01T09:00:00+05:00",
  end_time: "2026-05-01T10:00:00+05:00",
  user_id: 1,
  user: baseUser,
  created_at: "",
  guests: ["Анна Смит"],
  recurrence: "none" as const,
  recurrence_until: null,
  recurrence_group_id: null,
  recurrence_days: [],
};

function renderPage(opts: {
  booking?: typeof baseBooking;
  currentUserId?: number;
  onBack?: () => void;
  onDeleted?: () => void;
  onReschedule?: (defaultStart: string, defaultEnd: string) => void;
}) {
  vi.mocked(useAuth).mockReturnValue({
    user: { ...baseUser, id: opts.currentUserId ?? 1 },
    isLoading: false,
    isAuthenticated: true,
    setToken: vi.fn(),
    logout: vi.fn(),
  });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <BookingDetailPage
        booking={opts.booking ?? baseBooking}
        onBack={opts.onBack ?? vi.fn()}
        onDeleted={opts.onDeleted ?? vi.fn()}
        onReschedule={opts.onReschedule ?? vi.fn()}
      />
    </QueryClientProvider>
  );
}

function futureSlot(offsetMs: number, durationMs: number) {
  const startDate = new Date(Date.now() + offsetMs);
  const endDate = new Date(Date.now() + offsetMs + durationMs);
  const hhmm = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { start: hhmm(startDate), end: hhmm(endDate), available: true };
}

describe("BookingDetailPage", () => {
  beforeEach(() => {
    vi.mocked(useDeleteBooking).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null,
    } as any);
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.patch).mockReset();
  });

  it("shows title, time, organizer, guests, description", () => {
    renderPage({});
    expect(screen.getByText("Демо")).toBeInTheDocument();
    expect(screen.getByText(/Иван Иванов/)).toBeInTheDocument();
    expect(screen.getByText(/Анна Смит/)).toBeInTheDocument();
    expect(screen.getByText("Текст описания")).toBeInTheDocument();
  });

  it("shows cancel button for organizer, opens dialog, deletes", async () => {
    const mutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteBooking).mockReturnValue({
      mutateAsync: mutate,
      isPending: false,
      error: null,
    } as any);
    const onDeleted = vi.fn();
    renderPage({ currentUserId: 1, onDeleted });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Отменить встречу" }));
    expect(screen.getByText(/Отменить встречу\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Отменить" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ id: 5 });
      expect(onDeleted).toHaveBeenCalled();
    });
  });

  it("hides cancel button for non-organizer", () => {
    renderPage({ currentUserId: 999 });
    expect(
      screen.queryByRole("button", { name: "Отменить встречу" })
    ).not.toBeInTheDocument();
  });

  // ---------- Reschedule ----------

  it("shows reschedule button for organizer with recurrence=none", () => {
    renderPage({ currentUserId: 1 });
    expect(
      screen.getByRole("button", { name: "Перенести встречу" })
    ).toBeInTheDocument();
  });

  it("hides reschedule button for non-organizer", () => {
    renderPage({ currentUserId: 999 });
    expect(
      screen.queryByRole("button", { name: /Перенести/i })
    ).not.toBeInTheDocument();
  });

  it("hides reschedule button for recurring bookings", () => {
    const recurring = { ...baseBooking, recurrence: "weekly" as const };
    renderPage({ currentUserId: 1, booking: recurring });
    expect(
      screen.queryByRole("button", { name: /Перенести/i })
    ).not.toBeInTheDocument();
  });

  it("on click reschedule: fetches today's slots and calls onReschedule with prefill", async () => {
    const ONE_HOUR = 60 * 60 * 1000;
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [futureSlot(ONE_HOUR, 30 * 60 * 1000)],
    });
    const onReschedule = vi.fn();

    renderPage({ currentUserId: 1, onReschedule });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Перенести встречу" }));

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/v1/slots",
        expect.objectContaining({
          params: expect.objectContaining({ date: expect.any(String) }),
        })
      );
      expect(onReschedule).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      );
    });
  });

  it("shows error and does not call onReschedule when no available slots", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    const onReschedule = vi.fn();

    renderPage({ currentUserId: 1, onReschedule });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Перенести встречу" }));

    await screen.findByText(/На сегодня нет свободных слотов/i);
    expect(onReschedule).not.toHaveBeenCalled();
  });

  it("shows error when slots fetch fails", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("network"));
    const onReschedule = vi.fn();

    renderPage({ currentUserId: 1, onReschedule });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Перенести встречу" }));

    await screen.findByText(/Не удалось получить занятость/i);
    expect(onReschedule).not.toHaveBeenCalled();
  });
});
