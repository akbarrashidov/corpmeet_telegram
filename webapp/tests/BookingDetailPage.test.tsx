import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  useAuth: vi.fn(),
  useDeleteBooking: vi.fn(),
}));

import { useAuth, useDeleteBooking } from "@corpmeet/design/complex";
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

const baseBooking = {
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
  onDeleted?: () => void;
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
        onBack={vi.fn()}
        onDeleted={opts.onDeleted ?? vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe("BookingDetailPage", () => {
  it("shows title, time, organizer, guests, description", () => {
    vi.mocked(useDeleteBooking).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as any);
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
    // confirm dialog
    expect(screen.getByText(/Отменить встречу\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Отменить" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ id: 5 });
      expect(onDeleted).toHaveBeenCalled();
    });
  });

  it("hides cancel button for non-organizer", () => {
    vi.mocked(useDeleteBooking).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as any);
    renderPage({ currentUserId: 999 });
    expect(screen.queryByRole("button", { name: "Отменить встречу" })).not.toBeInTheDocument();
  });
});
