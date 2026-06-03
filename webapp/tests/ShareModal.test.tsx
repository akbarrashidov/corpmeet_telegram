import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../src/lib/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("../src/lib/telegram", () => ({
  getTelegram: vi.fn(),
}));

vi.mock("../src/lib/haptic", () => ({
  haptic: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
}));

import { copyToClipboard } from "../src/lib/clipboard";
import { getTelegram } from "../src/lib/telegram";
import { ShareModal } from "../src/components/ShareModal";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShareModal", () => {
  it("renders code and copy/share buttons when invite code is present", () => {
    render(
      <ShareModal
        open
        roomName="Rm1350"
        inviteCode="ABCD-1234"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("ABCD-1234")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Скопировать код/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Поделиться в Telegram/i })).toBeInTheDocument();
  });

  it("does not render when open=false", () => {
    const { container } = render(
      <ShareModal open={false} roomName="X" inviteCode="X" onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows no_code state when invite code is null", () => {
    render(
      <ShareModal open roomName="Rm1350" inviteCode={null} onClose={() => {}} />,
    );
    expect(screen.getByText(/нет кода приглашения/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Скопировать код/i })).not.toBeInTheDocument();
  });

  it("copies the code and switches button to 'Скопировано' on success", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue(true);
    render(
      <ShareModal open roomName="Rm1350" inviteCode="ABCD-1234" onClose={() => {}} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Скопировать код/i }));
    expect(copyToClipboard).toHaveBeenCalledWith("ABCD-1234");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Скопировано/i })).toBeInTheDocument(),
    );
  });

  it("calls openTelegramLink with t.me/share URL containing code", async () => {
    const openTelegramLink = vi.fn();
    vi.mocked(getTelegram).mockReturnValue({ openTelegramLink } as any);
    render(
      <ShareModal open roomName="Rm1350" inviteCode="ABCD-1234" onClose={() => {}} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Поделиться в Telegram/i }));
    expect(openTelegramLink).toHaveBeenCalledTimes(1);
    const url = openTelegramLink.mock.calls[0][0] as string;
    expect(url).toContain("https://t.me/share/url");
    expect(decodeURIComponent(url)).toContain("ABCD-1234");
    expect(decodeURIComponent(url)).toContain("Rm1350");
  });

  it("falls back to window.open when Telegram WebApp is not available", async () => {
    vi.mocked(getTelegram).mockReturnValue(null as any);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ShareModal open roomName="Rm1350" inviteCode="ABCD-1234" onClose={() => {}} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Поделиться в Telegram/i }));
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(
      <ShareModal open roomName="Rm1350" inviteCode="ABCD-1234" onClose={onClose} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Закрыть/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
