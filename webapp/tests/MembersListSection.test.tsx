import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { WorkspaceDetail, WorkspaceMember } from "../src/hooks/useWorkspaceDetail";

vi.mock("../src/hooks/useWorkspaceDetail", () => ({
  useWorkspaceDetail: vi.fn(),
}));

vi.mock("../src/hooks/useRemoveMember", () => ({
  useRemoveMember: vi.fn(),
}));

vi.mock("@corpmeet/design/complex", async () => {
  const actual = await vi.importActual<any>("@corpmeet/design/complex");
  return {
    ...actual,
    useAuth: () => ({ user: { id: 100 } }),
  };
});

import { useWorkspaceDetail } from "../src/hooks/useWorkspaceDetail";
import { useRemoveMember } from "../src/hooks/useRemoveMember";
import { MembersListSection } from "../src/components/MembersListSection";

function makeMember(over: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: 1,
    workspace_id: 10,
    user_id: 1,
    pending_username: null,
    role: "member",
    status: "active",
    invite_deep_link: null,
    user: {
      id: 1,
      username: "ivanov",
      first_name: "Иван",
      last_name: "Иванов",
      display_name: "Иван Иванов",
      position: null,
    } as any,
    position_id: 1,
    position: {
      id: 1,
      workspace_id: 10,
      name_ru: "PM",
      name_uz: "PM",
      created_at: "2026-05-30T10:00:00+05:00",
    },
    created_at: "2026-05-30T10:00:00+05:00",
    invite_expires_at: null,
    ...over,
  };
}

function mockDetail(over: Partial<WorkspaceDetail> = {}) {
  vi.mocked(useWorkspaceDetail).mockReturnValue({
    data: {
      id: 10,
      name: "Test",
      slug: "test",
      invite_code: "ABC",
      timezone: "Asia/Tashkent",
      telegram_chat_id: null,
      created_at: "2026-05-30T10:00:00+05:00",
      my_role: "owner",
      members: [makeMember()],
      pending_members: [],
      tg_invite_link: null,
      ...over,
    },
    isLoading: false,
  } as any);
}

function renderSection() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MembersListSection workspaceId={10} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(useRemoveMember).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as any);
});

describe("MembersListSection", () => {
  it("renders display name + position + role", () => {
    mockDetail();
    renderSection();
    expect(screen.getByText("Иван Иванов")).toBeInTheDocument();
    expect(screen.getByText("PM")).toBeInTheDocument();
    expect(screen.getByText("Участник")).toBeInTheDocument();
  });

  it("hides position chip when member has no position", () => {
    mockDetail({
      members: [makeMember({ position_id: null, position: null })],
    } as any);
    renderSection();
    expect(screen.queryByText("PM")).not.toBeInTheDocument();
  });

  it("owner can remove other members but not themselves", () => {
    mockDetail({
      members: [
        makeMember({ id: 1, user_id: 100, user: { ...makeMember().user!, id: 100 } as any, role: "owner" }),
        makeMember({ id: 2, user_id: 200, user: { ...makeMember().user!, id: 200, display_name: "Лейла" } as any }),
      ],
    } as any);
    renderSection();
    expect(screen.queryByLabelText('Удалить «Иван Иванов»')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Удалить «Лейла»')).toBeInTheDocument();
  });

  it("member role sees no delete buttons", () => {
    mockDetail({
      my_role: "member",
      members: [
        makeMember({ id: 1, user_id: 200, user: { ...makeMember().user!, id: 200, display_name: "Лейла" } as any }),
      ],
    });
    renderSection();
    expect(screen.queryByRole("button", { name: /Удалить/ })).not.toBeInTheDocument();
  });

  it("empty state when no active members", () => {
    mockDetail({ members: [] });
    renderSection();
    expect(screen.getByText(/нет других участников/i)).toBeInTheDocument();
  });
});
