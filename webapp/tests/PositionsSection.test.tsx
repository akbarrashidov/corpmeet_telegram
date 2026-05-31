import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../src/hooks/usePositions", () => ({
  usePositions: vi.fn(),
  useCreatePosition: vi.fn(),
  useUpdatePosition: vi.fn(),
  useDeletePosition: vi.fn(),
}));

vi.mock("../src/hooks/useWorkspaceDetail", () => ({
  useWorkspaceDetail: vi.fn(),
}));

import {
  usePositions,
  useCreatePosition,
  useUpdatePosition,
  useDeletePosition,
} from "../src/hooks/usePositions";
import { useWorkspaceDetail } from "../src/hooks/useWorkspaceDetail";
import { PositionsSection } from "../src/components/PositionsSection";

function mockOwner() {
  vi.mocked(useWorkspaceDetail).mockReturnValue({
    data: {
      id: 10,
      name: "WS",
      slug: "ws",
      invite_code: "C",
      timezone: "UTC",
      telegram_chat_id: null,
      created_at: "2026-01-01T00:00:00Z",
      my_role: "owner",
      members: [],
      pending_members: [],
      tg_invite_link: null,
    },
    isLoading: false,
  } as any);
}

function mockMember() {
  vi.mocked(useWorkspaceDetail).mockReturnValue({
    data: {
      id: 10,
      name: "WS",
      slug: "ws",
      invite_code: "C",
      timezone: "UTC",
      telegram_chat_id: null,
      created_at: "2026-01-01T00:00:00Z",
      my_role: "member",
      members: [],
      pending_members: [],
      tg_invite_link: null,
    },
    isLoading: false,
  } as any);
}

function mockPositions(list: Array<{ id: number; name_ru: string; name_uz?: string }>) {
  vi.mocked(usePositions).mockReturnValue({
    data: list.map((p) => ({
      id: p.id,
      workspace_id: 10,
      name_ru: p.name_ru,
      name_uz: p.name_uz ?? p.name_ru,
      created_at: "2026-01-01T00:00:00Z",
    })),
    isLoading: false,
  } as any);
}

const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

function renderSection() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PositionsSection workspaceId={10} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  createMutate.mockReset().mockResolvedValue(undefined);
  updateMutate.mockReset().mockResolvedValue(undefined);
  deleteMutate.mockReset().mockResolvedValue(undefined);
  vi.mocked(useCreatePosition).mockReturnValue({
    mutateAsync: createMutate,
    isPending: false,
  } as any);
  vi.mocked(useUpdatePosition).mockReturnValue({
    mutateAsync: updateMutate,
    isPending: false,
  } as any);
  vi.mocked(useDeletePosition).mockReturnValue({
    mutateAsync: deleteMutate,
    isPending: false,
  } as any);
  vi.mocked(usePositions).mockReset();
  vi.mocked(useWorkspaceDetail).mockReset();
});

describe("PositionsSection", () => {
  it("shows empty state when no positions exist", () => {
    mockOwner();
    mockPositions([]);
    renderSection();
    expect(screen.getByText(/Должностей пока нет/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Добавить должность/i })).toBeInTheDocument();
  });

  it("renders existing positions with name_ru as primary", () => {
    mockOwner();
    mockPositions([
      { id: 1, name_ru: "Аналитик", name_uz: "Analitik" },
      { id: 2, name_ru: "Менеджер", name_uz: "Menejer" },
    ]);
    renderSection();
    expect(screen.getByText("Аналитик")).toBeInTheDocument();
    expect(screen.getByText("Analitik")).toBeInTheDocument();
    expect(screen.getByText("Менеджер")).toBeInTheDocument();
  });

  it("opens inline create form on '+ Добавить'", async () => {
    mockOwner();
    mockPositions([]);
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Добавить должность/i }));
    expect(screen.getByLabelText("Название на русском")).toBeInTheDocument();
    expect(screen.getByLabelText("O'zbekcha nomi")).toBeInTheDocument();
  });

  it("creates new position on save", async () => {
    mockOwner();
    mockPositions([]);
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Добавить должность/i }));
    await user.type(screen.getByLabelText("Название на русском"), "Дизайнер");
    await user.type(screen.getByLabelText("O'zbekcha nomi"), "Dizayner");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(createMutate).toHaveBeenCalledWith({
      name_ru: "Дизайнер",
      name_uz: "Dizayner",
    });
  });

  it("save button is disabled when either field is empty", async () => {
    mockOwner();
    mockPositions([]);
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Добавить должность/i }));
    const saveBtn = screen.getByRole("button", { name: "Сохранить" });
    expect(saveBtn).toBeDisabled();
    await user.type(screen.getByLabelText("Название на русском"), "PM");
    expect(saveBtn).toBeDisabled();  // uz ещё пуст
    await user.type(screen.getByLabelText("O'zbekcha nomi"), "PM");
    expect(saveBtn).toBeEnabled();
  });

  it("opens edit form on ✏️ with prefilled values, saves via update", async () => {
    mockOwner();
    mockPositions([{ id: 7, name_ru: "PM", name_uz: "PM" }]);
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Редактировать «PM»/ }));
    const ruInput = screen.getByLabelText("Название на русском") as HTMLInputElement;
    expect(ruInput.value).toBe("PM");
    await user.clear(ruInput);
    await user.type(ruInput, "Product Manager");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(updateMutate).toHaveBeenCalledWith({
      id: 7,
      body: { name_ru: "Product Manager", name_uz: "PM" },
    });
  });

  it("opens confirm dialog on ✕ and deletes on confirm", async () => {
    mockOwner();
    mockPositions([{ id: 7, name_ru: "PM", name_uz: "PM" }]);
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Удалить «PM»/ }));
    expect(screen.getByText('Удалить «PM»?')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(deleteMutate).toHaveBeenCalledWith(7);
  });

  it("hides edit/delete buttons when user is member (not owner/admin)", () => {
    mockMember();
    mockPositions([{ id: 1, name_ru: "Аналитик" }]);
    renderSection();
    expect(screen.queryByRole("button", { name: /Редактировать/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Удалить/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Добавить должность/ })).not.toBeInTheDocument();
  });

  // Тест на body_with_count работает с настоящим workspace.members массивом
  it("delete dialog includes member count when position has assignees", async () => {
    vi.mocked(useWorkspaceDetail).mockReturnValue({
      data: {
        id: 10, name: "WS", slug: "ws", invite_code: "C",
        timezone: "UTC", telegram_chat_id: null,
        created_at: "2026-01-01T00:00:00Z", my_role: "owner",
        members: [
          { id: 1, workspace_id: 10, user_id: 1, pending_username: null,
            role: "member", status: "active", invite_deep_link: null,
            user: { id: 1, display_name: "A", username: "a",
              first_name: "A", last_name: null, position: null },
            position_id: 7, position: null,
            created_at: "2026-01-01T00:00:00Z", invite_expires_at: null },
          { id: 2, workspace_id: 10, user_id: 2, pending_username: null,
            role: "member", status: "active", invite_deep_link: null,
            user: { id: 2, display_name: "B", username: "b",
              first_name: "B", last_name: null, position: null },
            position_id: 7, position: null,
            created_at: "2026-01-01T00:00:00Z", invite_expires_at: null },
        ],
        pending_members: [], tg_invite_link: null,
      },
      isLoading: false,
    } as any);
    mockPositions([{ id: 7, name_ru: "PM", name_uz: "PM" }]);
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Удалить «PM»/ }));
    expect(screen.getByText(/2 участников/)).toBeInTheDocument();

    // suppress unused warning
    void fireEvent;
  });
});
