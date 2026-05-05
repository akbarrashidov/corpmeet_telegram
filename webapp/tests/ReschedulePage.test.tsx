import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from "@corpmeet/design/complex";
import { ReschedulePage } from "../src/pages/ReschedulePage";

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
  description: null,
  start_time: "2026-05-04T11:30:00+05:00",
  end_time: "2026-05-04T11:45:00+05:00",
  user_id: 1,
  user: baseUser,
  created_at: "",
  guests: [],
  recurrence: "none" as const,
  recurrence_until: null,
  recurrence_group_id: null,
  recurrence_days: [],
};

function renderPage(opts: {
  defaultStart?: string;
  defaultEnd?: string;
  onBack?: () => void;
  onSaved?: () => void;
}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ReschedulePage
        booking={baseBooking}
        defaultStart={opts.defaultStart ?? "2026-05-04T12:00"}
        defaultEnd={opts.defaultEnd ?? "2026-05-04T12:15"}
        onBack={opts.onBack ?? vi.fn()}
        onSaved={opts.onSaved ?? vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe("ReschedulePage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.patch).mockReset();
  });

  it("renders title and inputs prefilled with defaults", () => {
    renderPage({});
    expect(screen.getByText("Демо")).toBeInTheDocument();
    expect(screen.getByLabelText(/Начало/i)).toHaveValue("2026-05-04T12:00");
    expect(screen.getByLabelText(/Конец/i)).toHaveValue("2026-05-04T12:15");
  });

  it("on submit: PATCHes booking with edited times and calls onSaved", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    const onSaved = vi.fn();
    renderPage({ onSaved });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Перенести/i }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/bookings/5",
        expect.objectContaining({
          start_time: expect.any(String),
          end_time: expect.any(String),
        })
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("validates that end is after start", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    const onSaved = vi.fn();
    renderPage({
      defaultStart: "2026-05-04T13:00",
      defaultEnd: "2026-05-04T13:00",
      onSaved,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Перенести/i }));

    expect(
      screen.getByText(/Конец должен быть позже начала/i)
    ).toBeInTheDocument();
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows error when PATCH fails", async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error("server"));
    const onSaved = vi.fn();
    renderPage({ onSaved });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Перенести/i }));

    await screen.findByText(/Не удалось перенести/i);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
