import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../src/hooks/useInviteMember", () => ({
  useInviteMember: vi.fn(),
}));
vi.mock("../src/hooks/useGenerateInviteLink", () => ({
  useGenerateInviteLink: vi.fn(),
}));

import { useInviteMember } from "../src/hooks/useInviteMember";
import { useGenerateInviteLink } from "../src/hooks/useGenerateInviteLink";
import { InviteByUsernameForm } from "../src/components/InviteByUsernameForm";

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <InviteByUsernameForm workspaceId={10} />
    </QueryClientProvider>,
  );
}

function setMocks(invite: any = {}, anon: any = {}) {
  vi.mocked(useInviteMember).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    ...invite,
  } as any);
  vi.mocked(useGenerateInviteLink).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    ...anon,
  } as any);
}

beforeEach(() => setMocks());

describe("InviteByUsernameForm", () => {
  it("shows error on empty submit", async () => {
    const inviteSpy = vi.fn();
    setMocks({ mutateAsync: inviteSpy });
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Пригласить" }));
    expect(screen.getByText(/Введи @username/i)).toBeInTheDocument();
    expect(inviteSpy).not.toHaveBeenCalled();
  });

  it("calls mutateAsync with username stripped of leading @", async () => {
    const inviteSpy = vi.fn().mockResolvedValue({});
    setMocks({ mutateAsync: inviteSpy });
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("@username"), "@leyla");
    await user.click(screen.getByRole("button", { name: "Пригласить" }));
    expect(inviteSpy).toHaveBeenCalledWith("leyla");
  });

  it("calls mutateAsync without modification when no @ prefix", async () => {
    const inviteSpy = vi.fn().mockResolvedValue({});
    setMocks({ mutateAsync: inviteSpy });
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("@username"), "leyla");
    await user.click(screen.getByRole("button", { name: "Пригласить" }));
    expect(inviteSpy).toHaveBeenCalledWith("leyla");
  });

  it("anonymous button calls generateLink mutation", async () => {
    const anonSpy = vi.fn().mockResolvedValue({});
    setMocks({}, { mutateAsync: anonSpy });
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Создать одноразовую/i }));
    expect(anonSpy).toHaveBeenCalled();
  });
});
