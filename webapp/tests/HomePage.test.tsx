import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  useAuth: vi.fn(),
  useBookings: vi.fn(),
  useActiveBookings: vi.fn(),
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../src/hooks/useInvitedBookings", () => ({
  useInvitedBookings: vi.fn(),
}));

import { useAuth, useBookings, useActiveBookings } from "@corpmeet/design/complex";
import { useInvitedBookings } from "../src/hooks/useInvitedBookings";
import { HomePage } from "../src/pages/HomePage";
import { todayIso } from "../src/lib/datetime";
import type { HomeTab } from "../src/components/HomeChips";

function HomePageWrapper({
  onCreate = vi.fn(),
  onSelect = vi.fn(),
  onProfile = vi.fn(),
}: {
  onCreate?: () => void;
  onSelect?: (b: any) => void;
  onProfile?: () => void;
}) {
  const [tab, setTab] = useState<HomeTab>("today");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  return (
    <HomePage
      tab={tab}
      onTabChange={setTab}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      onCreate={onCreate}
      onSelect={onSelect}
      onProfile={onProfile}
    />
  );
}

function renderPage(props: { onCreate?: () => void; onSelect?: (b: any) => void } = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <HomePageWrapper {...props} />
    </QueryClientProvider>
  );
}

const baseUser = {
  id: 1,
  telegram_id: 100,
  username: null,
  first_name: "Иван",
  last_name: "Иванов",
  role: "user" as const,
  display_name: "Иван Иванов",
  position: null,
};

const baseBooking = {
  id: 1,
  title: "Утренняя планёрка",
  description: null,
  start_time: "2026-05-01T09:00:00+05:00",
  end_time: "2026-05-01T10:00:00+05:00",
  user_id: 99,
  user: { ...baseUser, id: 99 },
  created_at: "",
  guests: [],
  recurrence: "none" as const,
  recurrence_until: null,
  recurrence_group_id: null,
  recurrence_days: [],
};

function setupHooks(opts?: {
  todayBookings?: typeof baseBooking[];
  mineBookings?: typeof baseBooking[];
  invitedBookings?: typeof baseBooking[];
  todayLoading?: boolean;
}) {
  vi.mocked(useAuth).mockReturnValue({
    user: baseUser,
    isLoading: false,
    isAuthenticated: true,
    setToken: vi.fn(),
    logout: vi.fn(),
  });
  vi.mocked(useBookings).mockReturnValue({
    data: opts?.todayBookings,
    isLoading: opts?.todayLoading ?? false,
    isFetching: false,
    error: null,
  });
  vi.mocked(useActiveBookings).mockReturnValue({
    data: opts?.mineBookings,
    isLoading: false,
    isFetching: false,
    error: null,
  });
  vi.mocked(useInvitedBookings).mockReturnValue({
    data: opts?.invitedBookings,
    isLoading: false,
    isFetching: false,
    error: null,
  } as any);
}

describe("HomePage", () => {
  it("renders today's bookings by default", () => {
    setupHooks({ todayBookings: [{ ...baseBooking, title: "Сегодня встреча" }] });
    renderPage();
    expect(screen.getByText("Сегодня встреча")).toBeInTheDocument();
  });

  it("switches to mine tab", async () => {
    setupHooks({
      todayBookings: [{ ...baseBooking, title: "Сегодня встреча" }],
      mineBookings: [{ ...baseBooking, id: 2, title: "Моя встреча" }],
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Мои" }));
    expect(screen.getByText("Моя встреча")).toBeInTheDocument();
  });

  it("invited tab shows badge on cards", async () => {
    setupHooks({ invitedBookings: [{ ...baseBooking, id: 3, title: "Зовут" }] });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Пригласили" }));
    expect(screen.getByText("Ты в гостях")).toBeInTheDocument();
  });

  it("shows skeleton while loading", () => {
    setupHooks({ todayLoading: true });
    renderPage();
    expect(screen.getAllByTestId("booking-skeleton").length).toBeGreaterThan(0);
  });

  it("shows empty message when no bookings", () => {
    setupHooks({ todayBookings: [] });
    renderPage();
    expect(screen.getByText(/Сегодня встреч не запланировано/i)).toBeInTheDocument();
  });

  it("clicks the + button to call onCreate", async () => {
    setupHooks({ todayBookings: [] });
    const onCreate = vi.fn();
    renderPage({ onCreate });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Забронировать" }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("clicks a booking card to call onSelect", async () => {
    setupHooks({ todayBookings: [{ ...baseBooking, title: "Кликни меня" }] });
    const onSelect = vi.fn();
    renderPage({ onSelect });
    const user = userEvent.setup();
    await user.click(screen.getByText("Кликни меня"));
    expect(onSelect).toHaveBeenCalled();
  });
});
