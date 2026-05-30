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
  it("renders initial label", () => {
    vi.mocked(useGenerateInviteLink).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    render(<InviteOneTimeButton workspaceId={1} />);
    expect(screen.getByRole("button", { name: "Пригласить коллегу" })).toBeInTheDocument();
  });

  it("generates link, copies to clipboard, shows copied state", async () => {
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

    expect(mutateAsync).toHaveBeenCalled();
    expect(copyToClipboard).toHaveBeenCalledWith(
      "https://t.me/corpmeet_dev_bot?start=invite_XYZ",
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Скопировано ✓" })).toBeInTheDocument();
    });
  });

  it("does not show copied if generate returns no deep link", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 42, invite_deep_link: null });
    vi.mocked(useGenerateInviteLink).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);
    vi.mocked(copyToClipboard).mockResolvedValue(true);

    render(<InviteOneTimeButton workspaceId={1} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Пригласить коллегу" }));

    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Пригласить коллегу" })).toBeInTheDocument();
  });
});
