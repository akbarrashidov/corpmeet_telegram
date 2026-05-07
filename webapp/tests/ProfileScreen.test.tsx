import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  useAuth: vi.fn(),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { apiClient, useAuth } from "@corpmeet/design/complex";
import { ProfileScreen } from "../src/pages/ProfileScreen";

const baseUser = {
  id: 1,
  telegram_id: 100,
  username: null,
  first_name: "Alisher",
  last_name: "Rakhimov",
  role: "user" as const,
  display_name: "Alisher Rakhimov",
  position: "PM" as string | null,
};

function setupAuth(overrides: Partial<typeof baseUser> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: { ...baseUser, ...overrides },
    isLoading: false,
    isAuthenticated: true,
    setToken: vi.fn(),
    logout: vi.fn(),
  });
}

function renderScreen(props: { onBack?: () => void; onSaved?: () => void } = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileScreen
        onBack={props.onBack ?? vi.fn()}
        onSaved={props.onSaved ?? vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe("ProfileScreen", () => {
  it("prefills fields from useAuth user", () => {
    setupAuth();
    renderScreen();
    expect(screen.getByLabelText(/Имя/i)).toHaveValue("Alisher");
    expect(screen.getByLabelText(/Фамилия/i)).toHaveValue("Rakhimov");
    expect(screen.getByRole("button", { name: "PM" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("submits PATCH with current values when nothing changed", async () => {
    setupAuth();
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} } as any);
    const onSaved = vi.fn();
    renderScreen({ onSaved });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/auth/me", {
        first_name: "Alisher",
        last_name: "Rakhimov",
        position: "PM",
      });
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("changes position and submits new value", async () => {
    setupAuth();
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} } as any);
    renderScreen();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Дизайнер" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/auth/me", {
        first_name: "Alisher",
        last_name: "Rakhimov",
        position: "Дизайнер",
      });
    });
  });

  it("submits position=null when 'Не указана' picked", async () => {
    setupAuth();
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} } as any);
    renderScreen();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Не указана" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/auth/me", {
        first_name: "Alisher",
        last_name: "Rakhimov",
        position: null,
      });
    });
  });

  it("rejects lowercase first name", async () => {
    setupAuth({ first_name: "alisher" });
    vi.mocked(apiClient.patch).mockClear();
    renderScreen();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(screen.getByText(/Имя — латиница/i)).toBeInTheDocument();
  });

  it("calls onBack when ✕ clicked", async () => {
    setupAuth();
    const onBack = vi.fn();
    renderScreen({ onBack });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Закрыть" }));

    expect(onBack).toHaveBeenCalled();
  });

  it("shows server error and stays on screen", async () => {
    setupAuth();
    vi.mocked(apiClient.patch).mockRejectedValue({
      response: { status: 422, data: { detail: "boom" } },
    });
    const onSaved = vi.fn();
    renderScreen({ onSaved });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await screen.findByText(/\[422\] boom/i);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
