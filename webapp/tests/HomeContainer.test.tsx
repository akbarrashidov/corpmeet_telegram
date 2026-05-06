import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  useAuth: vi.fn(() => ({
    user: { id: 1, telegram_id: 100, username: null, first_name: "Иван", last_name: "Иванов", role: "user", display_name: "Иван Иванов" },
    isLoading: false,
    isAuthenticated: true,
    setToken: vi.fn(),
    logout: vi.fn(),
  })),
  useBookings: vi.fn(() => ({ data: [], isLoading: false, isFetching: false, error: null })),
  useActiveBookings: vi.fn(() => ({ data: [], isLoading: false, isFetching: false, error: null })),
  useCreateBooking: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, error: null })),
  useDeleteBooking: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, error: null })),
  useUsers: vi.fn(() => ({ data: [], isLoading: false, isFetching: false, error: null })),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock("../src/hooks/useInvitedBookings", () => ({
  useInvitedBookings: vi.fn(() => ({ data: [], isLoading: false, isFetching: false, error: null })),
}));

import { HomeContainer } from "../src/pages/HomeContainer";
import { addDaysIso, formatDayMonth, todayIso } from "../src/lib/datetime";

function renderApp() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <HomeContainer />
    </QueryClientProvider>
  );
}

describe("HomeContainer navigation", () => {
  it("starts on list view", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "День" })).toBeInTheDocument();
  });

  it("opens create page on + click and goes back on ←", async () => {
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Забронировать" }));
    expect(screen.getByText(/Новая встреча/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByRole("button", { name: "День" })).toBeInTheDocument();
  });

  it("propagates selected date to create page as defaultDate", async () => {
    renderApp();
    const user = userEvent.setup();

    const tomorrow = addDaysIso(todayIso(), 1);
    const tomorrowLabel = formatDayMonth(tomorrow);

    await user.click(screen.getByRole("button", { name: tomorrowLabel }));
    await user.click(screen.getByRole("button", { name: "Забронировать" }));

    const start = screen.getByLabelText(/Начало/i) as HTMLInputElement;
    expect(start.value).toBe(`${tomorrow}T09:00`);
  });
});
