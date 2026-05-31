import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const decideMutate = vi.fn();
vi.mock("../src/hooks/useDecideJoinRequest", () => ({
  useDecideJoinRequest: vi.fn(() => ({
    mutateAsync: decideMutate,
    isPending: false,
  })),
}));

vi.mock("../src/hooks/useWorkspaceDetail", () => ({
  useWorkspaceDetail: vi.fn(),
}));

import { useWorkspaceDetail } from "../src/hooks/useWorkspaceDetail";
import { PendingJoinRequests } from "../src/components/PendingJoinRequests";

function setupPending(
  pending: Array<{
    id: number;
    user_id: number | null;
    pending_username?: string | null;
    status?: "pending" | "active";
    display_name?: string;
    username?: string | null;
  }>,
) {
  vi.mocked(useWorkspaceDetail).mockReturnValue({
    data: {
      id: 10,
      name: "WS",
      slug: "w",
      invite_code: "C",
      timezone: "UTC",
      telegram_chat_id: null,
      created_at: "2026-01-01T00:00:00Z",
      my_role: "owner",
      members: [],
      pending_members: pending.map((p) => ({
        id: p.id,
        workspace_id: 10,
        user_id: p.user_id,
        pending_username: p.pending_username ?? null,
        role: "member",
        status: p.status ?? "pending",
        invite_deep_link: null,
        user: p.user_id === null ? null : {
          id: p.user_id,
          display_name: p.display_name ?? "—",
          username: p.username ?? null,
          first_name: null,
          last_name: null,
          position: null,
        },
        position_id: null,
        position: null,
        created_at: "2026-01-01T00:00:00Z",
        invite_expires_at: null,
      })),
      tg_invite_link: null,
    },
    isLoading: false,
  } as any);
}

beforeEach(() => {
  decideMutate.mockReset().mockResolvedValue(undefined);
  vi.mocked(useWorkspaceDetail).mockReset();
});

describe("PendingJoinRequests", () => {
  it("renders nothing when no pending join requests", () => {
    setupPending([]);
    const { container } = render(<PendingJoinRequests workspaceId={10} />);
    expect(container.firstChild).toBeNull();
  });

  it("filters out admin invitations (user_id===null) — only join-requests rendered", () => {
    setupPending([
      { id: 1, user_id: null, pending_username: "ivanov" },  // admin invitation, скрыта
      { id: 2, user_id: 42, display_name: "Анна Смит", username: "anna" },  // настоящая заявка
    ]);
    render(<PendingJoinRequests workspaceId={10} />);
    expect(screen.queryByText("ivanov")).not.toBeInTheDocument();
    expect(screen.getByText("Анна Смит")).toBeInTheDocument();
  });

  it("filters out active members (status===active)", () => {
    setupPending([
      { id: 1, user_id: 42, display_name: "Анна", status: "active" },
      { id: 2, user_id: 43, display_name: "Борис", status: "pending" },
    ]);
    render(<PendingJoinRequests workspaceId={10} />);
    expect(screen.queryByText("Анна")).not.toBeInTheDocument();
    expect(screen.getByText("Борис")).toBeInTheDocument();
  });

  it("shows heading with count of requests", () => {
    setupPending([
      { id: 1, user_id: 42, display_name: "A" },
      { id: 2, user_id: 43, display_name: "B" },
    ]);
    render(<PendingJoinRequests workspaceId={10} />);
    expect(screen.getByText(/Заявки на вступление \(2\)/)).toBeInTheDocument();
  });

  it("approve button calls mutation with approve:true", async () => {
    setupPending([{ id: 7, user_id: 42, display_name: "Анна", username: "anna" }]);
    render(<PendingJoinRequests workspaceId={10} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Принять заявку от Анна/ }));

    expect(decideMutate).toHaveBeenCalledWith({ memberId: 7, approve: true });
  });

  it("reject button calls mutation with approve:false", async () => {
    setupPending([{ id: 7, user_id: 42, display_name: "Анна" }]);
    render(<PendingJoinRequests workspaceId={10} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Отклонить заявку от Анна/ }));

    expect(decideMutate).toHaveBeenCalledWith({ memberId: 7, approve: false });
  });

  it("renders @username below display_name when available", () => {
    setupPending([{ id: 1, user_id: 42, display_name: "Анна", username: "anna" }]);
    render(<PendingJoinRequests workspaceId={10} />);
    expect(screen.getByText("@anna")).toBeInTheDocument();
  });
});
