import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { apiClient } from "@corpmeet/design/complex";
import { BindChatScreen } from "../src/pages/BindChatScreen";

function renderScreen(chatId = -100123) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <BindChatScreen chatId={chatId} />
    </QueryClientProvider>
  );
}

const adminWorkspace = {
  id: 1,
  name: "Альфа Inc",
  slug: "alpha",
  invite_code: "ABC123",
  timezone: "UTC",
  telegram_chat_id: null,
  created_at: "2026-01-01T00:00:00Z",
  my_role: "owner" as const,
};

const memberWorkspace = {
  ...adminWorkspace,
  id: 2,
  name: "Не моё",
  my_role: "member" as const,
};

describe("BindChatScreen", () => {
  it("lists only workspaces where user is owner or admin", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [adminWorkspace, memberWorkspace] });
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText("Альфа Inc")).toBeInTheDocument();
    });
    expect(screen.queryByText("Не моё")).not.toBeInTheDocument();
  });

  it("PATCHes selected workspace with telegram_chat_id", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [adminWorkspace] });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    renderScreen(-100456);

    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByText("Альфа Inc")).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/Альфа Inc/i));
    await user.click(screen.getByRole("button", { name: /Привязать/i }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/workspaces/1",
        { telegram_chat_id: -100456 }
      );
    });
    expect(screen.getByText("Готово")).toBeInTheDocument();
  });

  it("shows empty state when user has no admin workspaces", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [memberWorkspace] });
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/Нет workspace/i)).toBeInTheDocument();
    });
  });
  it("opens create form on '+ Создать workspace' click in empty state", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    renderScreen();
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByText(/Нет workspace/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Создать workspace/i }));
    expect(screen.getByText("Новое пространство")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Команда Альфа/i)).toBeInTheDocument();
  });

  it("creates workspace and returns to list (now has the new one)", async () => {
    let workspaces: any[] = [];
    vi.mocked(apiClient.get).mockImplementation(() => Promise.resolve({ data: workspaces }));
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    vi.mocked(apiClient.post).mockImplementation(async () => {
      const newWs = {
        id: 42,
        name: "My New Team",
        slug: "my-new-team",
        invite_code: "NEW42",
        timezone: "Asia/Tashkent",
        telegram_chat_id: null,
        created_at: "2026-01-01T00:00:00Z",
        my_role: "owner" as const,
      };
      workspaces = [newWs];
      return { data: newWs };
    });

    renderScreen();
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByText(/Нет workspace/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Создать workspace/i }));
    await user.type(screen.getByPlaceholderText(/Команда Альфа/i), "My New Team");
    await user.click(screen.getByRole("button", { name: /^Создать$/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/workspaces",
        expect.objectContaining({ name: "My New Team" }),
      );
      expect(screen.getByText("My New Team")).toBeInTheDocument();
    });
  });
});
