import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  useCreateBooking: vi.fn(),
  useUsers: vi.fn(),
}));

vi.mock("../src/components/DateTimePicker", () => ({
  DateTimePicker: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <label>
      <span>{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  ),
}));

import { useCreateBooking, useUsers } from "@corpmeet/design/complex";
import { CreateBookingPage } from "../src/pages/CreateBookingPage";

function renderPage(
  props: Partial<{ onBack: () => void; onCreated: () => void; defaultDate: string }> = {}
) {
  vi.mocked(useUsers).mockReturnValue({
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
  } as any);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CreateBookingPage
        onBack={props.onBack ?? vi.fn()}
        onCreated={props.onCreated ?? vi.fn()}
        defaultDate={props.defaultDate}
      />
    </QueryClientProvider>
  );
}

describe("CreateBookingPage", () => {
  it("validates: title required", async () => {
    vi.mocked(useCreateBooking).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as any);
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Создать" }));
    expect(screen.getByText(/Назови встречу/i)).toBeInTheDocument();
  });

  it("submits and calls onCreated", async () => {
    const mutate = vi.fn().mockResolvedValue([]);
    vi.mocked(useCreateBooking).mockReturnValue({
      mutateAsync: mutate,
      isPending: false,
      error: null,
    } as any);
    const onCreated = vi.fn();
    renderPage({ onCreated });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Название/i), "Демо");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
      expect(onCreated).toHaveBeenCalled();
    });
    const arg = mutate.mock.calls[0][0];
    expect(arg.title).toBe("Демо");
    expect(arg.start_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(arg.end_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(arg.guests).toEqual([]);
  });

  it("submits guests added via GuestPicker (manual entry)", async () => {
    const mutate = vi.fn().mockResolvedValue([]);
    vi.mocked(useCreateBooking).mockReturnValue({
      mutateAsync: mutate,
      isPending: false,
      error: null,
    } as any);
    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Название/i), "Z");

    const guestInput = screen.getByPlaceholderText("Добавь гостя");
    await user.type(guestInput, "Иван Иванов{enter}");
    await user.type(guestInput, "все PM{enter}");

    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0].guests).toEqual(["Иван Иванов", "все PM"]);
  });

  it("shows error from server", async () => {
    const mutate = vi.fn().mockRejectedValue(new Error("boom"));
    vi.mocked(useCreateBooking).mockReturnValue({
      mutateAsync: mutate,
      isPending: false,
      error: null,
    } as any);
    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Название/i), "Z");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await screen.findByText(/Не удалось создать встречу/i);
  });

  it("prefills start/end at 09:00/10:00 when defaultDate is provided", () => {
    vi.mocked(useCreateBooking).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as any);
    renderPage({ defaultDate: "2026-12-25" });
    const start = screen.getByLabelText(/Начало/i) as HTMLInputElement;
    const end = screen.getByLabelText(/Конец/i) as HTMLInputElement;
    expect(start.value).toBe("2026-12-25T09:00");
    expect(end.value).toBe("2026-12-25T10:00");
  });
});
