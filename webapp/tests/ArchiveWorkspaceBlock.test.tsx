import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkspaceDetail } from "../src/hooks/useWorkspaceDetail";

vi.mock("../src/hooks/useArchiveWorkspace", () => ({
  useArchiveWorkspace: vi.fn(),
}));

import { useArchiveWorkspace } from "../src/hooks/useArchiveWorkspace";
import { ArchiveWorkspaceBlock } from "../src/components/ArchiveWorkspaceBlock";

function makeWorkspace(): WorkspaceDetail {
  return {
    id: 1,
    name: "Дримтим",
    slug: "test",
    invite_code: "ABC",
    timezone: "Asia/Tashkent",
    telegram_chat_id: null,
    created_at: "2026-05-30T10:00:00+05:00",
    my_role: "owner",
    members: [],
    pending_members: [],
    tg_invite_link: null,
  } as any;
}

describe("ArchiveWorkspaceBlock", () => {
  it("calls mutateAsync + onArchived on confirm", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(1);
    vi.mocked(useArchiveWorkspace).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);
    const onArchived = vi.fn();

    render(<ArchiveWorkspaceBlock workspace={makeWorkspace()} onArchived={onArchived} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Архивировать пространство" }));
    // Confirm-диалог открыт — кликаем по кнопке с ровно "Архивировать"
    await user.click(screen.getByRole("button", { name: "Архивировать" }));

    expect(mutateAsync).toHaveBeenCalled();
    expect(onArchived).toHaveBeenCalled();
  });

  it("dialog title includes workspace name", async () => {
    vi.mocked(useArchiveWorkspace).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<ArchiveWorkspaceBlock workspace={makeWorkspace()} onArchived={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Архивировать пространство" }));

    expect(screen.getByText(/Архивировать «Дримтим»\?/i)).toBeInTheDocument();
  });
});
