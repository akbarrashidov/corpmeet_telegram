import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkspaceDetail } from "../src/hooks/useWorkspaceDetail";

vi.mock("../src/hooks/useRebindWorkspace", () => ({
  useRebindWorkspace: vi.fn(),
}));

import { useRebindWorkspace } from "../src/hooks/useRebindWorkspace";
import { TelegramBindStatusBlock } from "../src/components/TelegramBindStatusBlock";

function makeWorkspace(chatId: number | null): WorkspaceDetail {
  return {
    id: 1,
    name: "Test",
    slug: "test",
    invite_code: "ABC",
    timezone: "Asia/Tashkent",
    telegram_chat_id: chatId,
    created_at: "2026-05-30T10:00:00+05:00",
    my_role: "owner",
    members: [],
    pending_members: [],
    tg_invite_link: null,
  } as any;
}

function mockRebind() {
  const mutateAsync = vi.fn();
  vi.mocked(useRebindWorkspace).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as any);
  return mutateAsync;
}

describe("TelegramBindStatusBlock", () => {
  it("shows instruction with bot username when unbound", () => {
    mockRebind();
    render(<TelegramBindStatusBlock workspace={makeWorkspace(null)} />);
    expect(screen.getByText(/Чтобы привязать группу/i)).toBeInTheDocument();
    expect(screen.getByText(/@corpmeet_dev_bot/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Отвязать/i })).not.toBeInTheDocument();
  });

  it("shows bound status and unbind button when bound", () => {
    mockRebind();
    render(<TelegramBindStatusBlock workspace={makeWorkspace(-100123)} />);
    expect(screen.getByText(/-100123/)).toBeInTheDocument();
    expect(screen.getByText(/привязана/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Отвязать/i })).toBeInTheDocument();
  });

  it("calls mutateAsync(null) on confirm", async () => {
    const mutateAsync = mockRebind();
    render(<TelegramBindStatusBlock workspace={makeWorkspace(-100123)} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Отвязать/i }));
    // В диалоге — кнопка confirm ровно "Отвязать"
    const confirmButtons = screen.getAllByRole("button", { name: /Отвязать/ });
    // Первая кнопка — sticky на странице, вторая в диалоге; кликаем по последней
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(mutateAsync).toHaveBeenCalledWith(null);
  });
});
