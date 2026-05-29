import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../src/hooks/useRegenerateInviteCode", () => ({
  useRegenerateInviteCode: vi.fn(),
}));

vi.mock("../src/lib/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

import { useRegenerateInviteCode } from "../src/hooks/useRegenerateInviteCode";
import { copyToClipboard } from "../src/lib/clipboard";
import { PublicInviteLinkBlock } from "../src/components/PublicInviteLinkBlock";

function renderBlock() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PublicInviteLinkBlock
        workspace={{
          id: 10,
          name: "Test",
          slug: "test",
          invite_code: "ABC123",
          timezone: "UTC",
          telegram_chat_id: null,
          created_at: "2026-01-01T00:00:00Z",
          my_role: "owner",
          members: [],
          pending_members: [],
        }}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(useRegenerateInviteCode).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as any);
  vi.mocked(copyToClipboard).mockReset();
});

describe("PublicInviteLinkBlock", () => {
  it("shows link with workspace invite_code", () => {
    renderBlock();
    expect(screen.getByText(/start=ws_ABC123/i)).toBeInTheDocument();
  });

  it("copy button calls clipboard with full link", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue(true);
    renderBlock();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Скопировать ссылку" }));
    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining("start=ws_ABC123"),
    );
  });

  it("regenerate opens confirm dialog before calling mutation", async () => {
    const regenSpy = vi.fn().mockResolvedValue({});
    vi.mocked(useRegenerateInviteCode).mockReturnValue({
      mutateAsync: regenSpy,
      isPending: false,
    } as any);
    renderBlock();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Обновить код" }));
    // Confirm dialog
    expect(screen.getByText(/Обновить код пространства/i)).toBeInTheDocument();
    // Подтвердить
    await user.click(screen.getByRole("button", { name: "Обновить" }));
    expect(regenSpy).toHaveBeenCalled();
  });
});
