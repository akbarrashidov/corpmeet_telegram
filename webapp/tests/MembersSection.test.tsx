import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  useAuth: vi.fn(),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../src/hooks/useWorkspaceDetail", () => ({
  useWorkspaceDetail: vi.fn(),
}));

vi.mock("../src/hooks/useRemoveMember", () => ({
  useRemoveMember: vi.fn(),
}));

// Хуки для invite-форм — пустышки, тут не тестируем
vi.mock("../src/hooks/useInviteMember", () => ({
  useInviteMember: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));
vi.mock("../src/hooks/useGenerateInviteLink", () => ({
  useGenerateInviteLink: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));
vi.mock("../src/hooks/useRegenerateInviteCode", () => ({
  useRegenerateInviteCode: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

import { useAuth } from "@corpmeet/design/complex";
import { useWorkspaceDetail } from "../src/hooks/useWorkspaceDetail";
import { useRemoveMember } from "../src/hooks/useRemoveMember";
import { MembersSection } from "../src/components/MembersSection";

function renderSection() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MembersSection workspaceId={10} />
    </QueryClientProvider>,
  );
}

function makeMember(over: any = {}) {
  return {
    id: 100,
    workspace_id: 10,
    user_id: 1,
    pending_username: null,
    role: "member" as const,
    status: "active" as const,
    invite_deep_link: null,
    user: {
      id: 1,
      display_name: "Alice",
      username: "alice",
      first_name: "Alice",
      last_name: null,
      position: null,
    },
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function setupAuth(userId: number) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: userId, display_name: "Me" } as any,
    isLoading: false,
    isAuthenticated: true,
    setToken: vi.fn(),
    logout: vi.fn(),
  });
}

function setupWorkspace(members: any[], myRole: "owner" | "admin" | "member" = "owner") {
  vi.mocked(useWorkspaceDetail).mockReturnValue({
    data: {
      id: 10,
      name: "Test WS",
      slug: "test",
      invite_code: "ABC123",
      timezone: "UTC",
      telegram_chat_id: null,
      created_at: "2026-01-01T00:00:00Z",
      my_role: myRole,
      members,
      pending_members: [],
    },
    isLoading: false,
  } as any);
}

beforeEach(() => {
  vi.mocked(useRemoveMember).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as any);
});

describe("MembersSection", () => {
  it("renders active member's display_name and role", () => {
    setupAuth(99);
    setupWorkspace([
      makeMember({ id: 100, user: { ...makeMember().user, id: 1, display_name: "Alice" }, role: "owner" }),
      makeMember({ id: 101, user: { ...makeMember().user, id: 2, display_name: "Bob" }, role: "member" }),
    ]);
    renderSection();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders pending invite separately with anonymous label", () => {
    setupAuth(99);
    setupWorkspace([
      makeMember({ id: 100, role: "owner" }),
      makeMember({
        id: 200, status: "pending", user_id: null, user: null,
        pending_username: null, invite_deep_link: "https://t.me/bot?start=invite_X",
      }),
    ]);
    renderSection();
    expect(screen.getByText(/Анонимная ссылка/i)).toBeInTheDocument();
  });

  it("renders pending invite with @username when set", () => {
    setupAuth(99);
    setupWorkspace([
      makeMember({ id: 100, role: "owner" }),
      makeMember({
        id: 201, status: "pending", user_id: null, user: null,
        pending_username: "leyla", invite_deep_link: "https://t.me/bot?start=invite_Y",
      }),
    ]);
    renderSection();
    expect(screen.getByText("@leyla")).toBeInTheDocument();
  });

  it("owner: shows invite form and public link block", () => {
    setupAuth(99);
    setupWorkspace([makeMember({ id: 100, role: "owner" })], "owner");
    renderSection();
    expect(screen.getByPlaceholderText("@username")).toBeInTheDocument();
    expect(screen.getByText(/Публичная ссылка/i)).toBeInTheDocument();
  });

  it("member (not owner/admin): no invite form, no public link", () => {
    setupAuth(99);
    setupWorkspace([makeMember({ id: 100, user_id: 99, user: { ...makeMember().user, id: 99 } })], "member");
    renderSection();
    expect(screen.queryByPlaceholderText("@username")).not.toBeInTheDocument();
    expect(screen.queryByText(/Публичная ссылка/i)).not.toBeInTheDocument();
  });

  it("owner can remove other member, not self", () => {
    setupAuth(99);
    setupWorkspace([
      makeMember({ id: 100, user_id: 99, user: { ...makeMember().user, id: 99, display_name: "Me" }, role: "owner" }),
      makeMember({ id: 101, user_id: 2, user: { ...makeMember().user, id: 2, display_name: "Bob" } }),
    ], "owner");
    renderSection();
    // Кнопка удаления есть только для Боба, не для Me
    expect(screen.getByLabelText(/Удалить «Bob»/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Удалить «Me»/i)).not.toBeInTheDocument();
  });

  it("admin cannot remove owner", () => {
    setupAuth(99);
    setupWorkspace([
      makeMember({ id: 100, user_id: 1, user: { ...makeMember().user, id: 1, display_name: "Owner" }, role: "owner" }),
      makeMember({ id: 101, user_id: 99, user: { ...makeMember().user, id: 99, display_name: "Me Admin" }, role: "admin" }),
    ], "admin");
    renderSection();
    expect(screen.queryByLabelText(/Удалить «Owner»/i)).not.toBeInTheDocument();
  });

  it("remove confirmation calls mutateAsync with member id", async () => {
    const mutateAsync = vi.fn();
    vi.mocked(useRemoveMember).mockReturnValue({
      mutateAsync, isPending: false,
    } as any);
    setupAuth(99);
    setupWorkspace([
      makeMember({ id: 100, user_id: 99, user: { ...makeMember().user, id: 99 }, role: "owner" }),
      makeMember({ id: 555, user_id: 2, user: { ...makeMember().user, id: 2, display_name: "Bob" } }),
    ], "owner");

    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Удалить «Bob»/i));
    // Confirm dialog появился — кнопка с текстом "Удалить"
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    expect(mutateAsync).toHaveBeenCalledWith(555);
  });
});
