import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@corpmeet/design/complex", () => ({
  useAuth: vi.fn(() => ({ user: { id: 1 } })),
}));

vi.mock("../src/lib/currentWorkspace", () => ({
  useCurrentWorkspaceId: vi.fn(() => 10),
}));

vi.mock("../src/hooks/useWorkspaceDetail", () => ({
  useWorkspaceDetail: vi.fn(),
}));

vi.mock("../src/hooks/usePositions", () => ({
  usePositions: vi.fn(),
}));

import { useWorkspaceDetail } from "../src/hooks/useWorkspaceDetail";
import { usePositions } from "../src/hooks/usePositions";
import { PositionWarningBanner } from "../src/components/PositionWarningBanner";

function setupDetail(positionId: number | null, status: "active" | "pending" = "active") {
  vi.mocked(useWorkspaceDetail).mockReturnValue({
    data: {
      id: 10, name: "WS", slug: "w", invite_code: "C",
      timezone: "UTC", telegram_chat_id: null,
      created_at: "2026-01-01T00:00:00Z", my_role: "member",
      members: [{
        id: 50, workspace_id: 10, user_id: 1, pending_username: null,
        role: "member", status, invite_deep_link: null,
        user: { id: 1, display_name: "Me", username: null,
          first_name: "Me", last_name: null, position: null },
        position_id: positionId, position: null,
        created_at: "2026-01-01T00:00:00Z", invite_expires_at: null,
      }],
      pending_members: [], tg_invite_link: null,
    },
    isLoading: false,
  } as any);
}

function setupPositions(count: number) {
  vi.mocked(usePositions).mockReturnValue({
    data: Array.from({ length: count }, (_, i) => ({
      id: i + 1, workspace_id: 10, name_ru: `P${i}`, name_uz: `P${i}`,
      created_at: "2026-01-01T00:00:00Z",
    })),
    isLoading: false,
  } as any);
}

beforeEach(() => {
  vi.mocked(useWorkspaceDetail).mockReset();
  vi.mocked(usePositions).mockReset();
});

describe("PositionWarningBanner", () => {
  it("renders when my position_id is null and positions exist", () => {
    setupDetail(null);
    setupPositions(2);
    render(<PositionWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/не указана должность/)).toBeInTheDocument();
  });

  it("does NOT render when my position is set", () => {
    setupDetail(1);
    setupPositions(2);
    render(<PositionWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does NOT render when workspace has no positions at all", () => {
    setupDetail(null);
    setupPositions(0);
    render(<PositionWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does NOT render when I'm not active member", () => {
    setupDetail(null, "pending");
    setupPositions(2);
    render(<PositionWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls onOpenProfile on button click", async () => {
    setupDetail(null);
    setupPositions(2);
    const onOpenProfile = vi.fn();
    render(<PositionWarningBanner onOpenProfile={onOpenProfile} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Указать" }));
    expect(onOpenProfile).toHaveBeenCalled();
  });
});
