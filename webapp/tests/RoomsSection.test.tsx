import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { WorkspaceRoom } from "@corpmeet/design/complex";

vi.mock("../src/hooks/useWorkspaceRooms", () => ({
  useWorkspaceRooms: vi.fn(),
}));

vi.mock("../src/hooks/useArchiveRoom", () => ({
  useArchiveRoom: vi.fn(),
}));

vi.mock("../src/hooks/useWorkspaceDetail", () => ({
  useWorkspaceDetail: vi.fn(),
}));

import { useWorkspaceRooms } from "../src/hooks/useWorkspaceRooms";
import { useArchiveRoom } from "../src/hooks/useArchiveRoom";
import { useWorkspaceDetail } from "../src/hooks/useWorkspaceDetail";
import { RoomsSection } from "../src/components/RoomsSection";

function makeWR(over: Partial<WorkspaceRoom> = {}): WorkspaceRoom {
  return {
    id: 100,
    workspace_id: 10,
    room: {
      id: 1,
      name: "Переговорная",
      description: null,
      invite_code: null,
      join_mode: "open",
      archived_at: null,
      created_at: "2026-05-26T10:00:00+05:00",
    },
    role: "owner",
    visibility: "full",
    created_at: "2026-05-26T10:00:00+05:00",
    ...over,
  };
}

function renderSection() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RoomsSection workspaceId={10} />
    </QueryClientProvider>,
  );
}

function mockArchive() {
  const mutateAsync = vi.fn();
  vi.mocked(useArchiveRoom).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as any);
  return mutateAsync;
}

describe("RoomsSection", () => {
  beforeEach(() => {
    // По умолчанию рендерим с ролью owner — иначе RBAC прячет кнопки управления.
    vi.mocked(useWorkspaceDetail).mockReturnValue({
      data: { my_role: "owner" },
      isLoading: false,
    } as any);
  });

  it("renders empty state when no rooms", () => {
    vi.mocked(useWorkspaceRooms).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    mockArchive();

    renderSection();
    expect(screen.getByText(/Пока нет ни одной переговорной/i)).toBeInTheDocument();
  });

  it("lists room names", () => {
    vi.mocked(useWorkspaceRooms).mockReturnValue({
      data: [
        makeWR({ id: 1, room: { ...makeWR().room, id: 1, name: "Большая" } }),
        makeWR({ id: 2, room: { ...makeWR().room, id: 2, name: "Малая" } }),
      ],
      isLoading: false,
    } as any);
    mockArchive();

    renderSection();
    expect(screen.getByText("Большая")).toBeInTheDocument();
    expect(screen.getByText("Малая")).toBeInTheDocument();
  });

  it("shows regular body in confirm dialog when archiving non-last room", async () => {
    vi.mocked(useWorkspaceRooms).mockReturnValue({
      data: [
        makeWR({ id: 1, room: { ...makeWR().room, id: 1, name: "Большая" } }),
        makeWR({ id: 2, room: { ...makeWR().room, id: 2, name: "Малая" } }),
      ],
      isLoading: false,
    } as any);
    mockArchive();

    renderSection();
    const user = userEvent.setup();
    const archiveButtons = screen.getAllByRole("button", { name: /Архивировать «Большая»/i });
    await user.click(archiveButtons[0]);

    expect(screen.getByText(/Архивировать «Большая»\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Комната пропадёт из списка/i)).toBeInTheDocument();
    expect(screen.queryByText(/последняя переговорная/i)).not.toBeInTheDocument();
  });

  it("shows last-room warning in confirm dialog when archiving the only room", async () => {
    vi.mocked(useWorkspaceRooms).mockReturnValue({
      data: [makeWR({ id: 1, room: { ...makeWR().room, id: 1, name: "Единственная" } })],
      isLoading: false,
    } as any);
    mockArchive();

    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Архивировать «Единственная»/i }));

    expect(screen.getByText(/последняя переговорная/i)).toBeInTheDocument();
  });

  it("calls mutateAsync with room id on confirm", async () => {
    const mutateAsync = vi.fn();
    vi.mocked(useArchiveRoom).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);
    vi.mocked(useWorkspaceRooms).mockReturnValue({
      data: [
        makeWR({ id: 1, room: { ...makeWR().room, id: 77, name: "Test" } }),
        makeWR({ id: 2, room: { ...makeWR().room, id: 88, name: "Another" } }),
      ],
      isLoading: false,
    } as any);

    renderSection();
    const user = userEvent.setup();
    // Открываем диалог через aria-label карточки «Test»
    await user.click(screen.getByRole("button", { name: /Архивировать «Test»/i }));
    // В диалоге кнопка confirm имеет accessible name ровно "Архивировать" (без скобок)
    await user.click(screen.getByRole("button", { name: "Архивировать" }));

    expect(mutateAsync).toHaveBeenCalledWith(77);
  });
    it("hides + Create and Archive buttons for non-admin", () => {
    vi.mocked(useWorkspaceDetail).mockReturnValue({
      data: { my_role: "member" },
      isLoading: false,
    } as any);
    vi.mocked(useWorkspaceRooms).mockReturnValue({
      data: [makeWR({ id: 1, room: { ...makeWR().room, id: 1, name: "Test" } })],
      isLoading: false,
    } as any);
    mockArchive();

    renderSection();
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Архивировать/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Создать переговорную/ })).not.toBeInTheDocument();
  });
});
