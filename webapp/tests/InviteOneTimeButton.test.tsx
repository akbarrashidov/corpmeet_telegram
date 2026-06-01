import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../src/hooks/useGenerateInviteLink", () => ({
  useGenerateInviteLink: vi.fn(),
}));

vi.mock("../src/lib/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

import { useGenerateInviteLink } from "../src/hooks/useGenerateInviteLink";
import { copyToClipboard } from "../src/lib/clipboard";
import { InviteOneTimeButton } from "../src/components/InviteOneTimeButton";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InviteOneTimeButton", () => {
  it("renders initial label idle", () => {
    vi.mocked(useGenerateInviteLink).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<InviteOneTimeButton workspaceId={1} />);
    expect(screen.getByRole("button", { name: "Пригласить коллегу" })).toBeInTheDocument();
  });

  it("first tap mutates and shows link + 'Скопировать ссылку' button (does NOT copy yet)", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      id: 42,
      invite_deep_link: "https://t.me/corpmeet_dev_bot?start=invite_XYZ",
    });
    vi.mocked(useGenerateInviteLink).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);

    render(<InviteOneTimeButton workspaceId={1} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Пригласить коллегу" }));

    expect(mutateAsync).toHaveBeenCalled();
    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(screen.getByText("https://t.me/corpmeet_dev_bot?start=invite_XYZ")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Скопировать ссылку" })).toBeInTheDocument();
    });
  });

  it("second tap (after generation) copies sync — preserves user-gesture", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      id: 42,
      invite_deep_link: "https://t.me/corpmeet_dev_bot?start=invite_XYZ",
    });
    vi.mocked(useGenerateInviteLink).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);
    vi.mocked(copyToClipboard).mockResolvedValue(true);

    render(<InviteOneTimeButton workspaceId={1} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Пригласить коллегу" }));
    await user.click(await screen.findByRole("button", { name: "Скопировать ссылку" }));

    expect(copyToClipboard).toHaveBeenCalledWith(
      "https://t.me/corpmeet_dev_bot?start=invite_XYZ",
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Скопировано ✓" })).toBeInTheDocument();
    });
  });

  it("returns to idle (without link) without remaining 'ready' if mutation returns no link", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 42, invite_deep_link: null });
    vi.mocked(useGenerateInviteLink).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);

    render(<InviteOneTimeButton workspaceId={1} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Пригласить коллегу" }));

    expect(copyToClipboard).not.toHaveBeenCalled();
    // Возвращается в idle с прежним лейблом
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Пригласить коллегу" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Скопировать ссылку" })).not.toBeInTheDocument();
  });
});
