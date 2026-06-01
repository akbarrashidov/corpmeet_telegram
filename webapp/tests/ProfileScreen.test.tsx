import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  useAuth: vi.fn(),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock("../src/lib/currentWorkspace", () => ({
  useCurrentWorkspaceId: vi.fn(() => 10),
  setCurrentWorkspaceId: vi.fn(),
}));

vi.mock("../src/hooks/useWorkspaceDetail", () => ({
  useWorkspaceDetail: vi.fn(),
}));

vi.mock("../src/hooks/usePositions", () => ({
  usePositions: vi.fn(),
}));

const updatePositionMutate = vi.fn();
vi.mock("../src/hooks/useUpdateMemberPosition", () => ({
  useUpdateMemberPosition: vi.fn(() => ({
    mutateAsync: updatePositionMutate,
    isPending: false,
  })),
}));

import { apiClient, useAuth } from "@corpmeet/design/complex";
import { useWorkspaceDetail } from "../src/hooks/useWorkspaceDetail";
import { usePositions } from "../src/hooks/usePositions";
import { ProfileScreen } from "../src/pages/ProfileScreen";

const baseUser = {
  id: 1,
  telegram_id: 100,
  username: null,
  first_name: "Alisher",
  last_name: "Rakhimov",
  role: "user" as const,
  display_name: "Alisher Rakhimov",
  position: null,
};

function setupAuth(overrides: Partial<typeof baseUser> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: { ...baseUser, ...overrides },
    isLoading: false,
    isAuthenticated: true,
    setToken: vi.fn(),
    logout: vi.fn(),
  });
}

function setupWorkspace(myPositionId: number | null = null) {
  vi.mocked(useWorkspaceDetail).mockReturnValue({
    data: {
      id: 10,
      name: "Test WS",
      slug: "test",
      invite_code: "C",
      timezone: "UTC",
      telegram_chat_id: null,
      created_at: "2026-01-01T00:00:00Z",
      my_role: "member",
      members: [{
        id: 50,
        workspace_id: 10,
        user_id: 1,
        pending_username: null,
        role: "member",
        status: "active",
        invite_deep_link: null,
        user: {
          id: 1,
          display_name: "Alisher Rakhimov",
          username: null,
          first_name: "Alisher",
          last_name: "Rakhimov",
          position: null,
        },
        position_id: myPositionId,
        position: null,
        created_at: "2026-01-01T00:00:00Z",
        invite_expires_at: null,
      }],
      pending_members: [],
      tg_invite_link: null,
    },
    isLoading: false,
  } as any);
}

function setupPositions(list: Array<{ id: number; name_ru: string; name_uz?: string }>) {
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

function renderScreen(props: { onBack?: () => void; onSaved?: () => void } = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileScreen
        onBack={props.onBack ?? vi.fn()}
        onSaved={props.onSaved ?? vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  updatePositionMutate.mockReset().mockResolvedValue(undefined);
  vi.mocked(apiClient.patch).mockReset().mockResolvedValue({ data: {} } as any);
  vi.mocked(useWorkspaceDetail).mockReset();
  vi.mocked(usePositions).mockReset();
});

describe("ProfileScreen", () => {
  it("prefills first/last name from useAuth", () => {
    setupAuth();
    setupWorkspace(null);
    setupPositions([{ id: 1, name_ru: "PM" }]);
    renderScreen();
    expect(screen.getByLabelText(/Имя/i)).toHaveValue("Alisher");
    expect(screen.getByLabelText(/Фамилия/i)).toHaveValue("Rakhimov");
  });

  it("does NOT send PATCH /auth/me when neither first nor last name changed", async () => {
    setupAuth();
    setupWorkspace(null);
    setupPositions([{ id: 1, name_ru: "PM" }]);
    const onSaved = vi.fn();
    renderScreen({ onSaved });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(updatePositionMutate).not.toHaveBeenCalled();
  });

  it("PATCH /auth/me with only first_name/last_name (no position field)", async () => {
    setupAuth();
    setupWorkspace(null);
    setupPositions([{ id: 1, name_ru: "PM" }]);
    renderScreen();

    const user = userEvent.setup();
    const firstNameInput = screen.getByLabelText(/Имя/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Bobur");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/auth/me", {
        first_name: "Bobur",
        last_name: "Rakhimov",
      });
    });
  });

  it("renders position selector when workspace + positions present", () => {
    setupAuth();
    setupWorkspace(null);
    setupPositions([{ id: 1, name_ru: "PM" }, { id: 2, name_ru: "Аналитик" }]);
    renderScreen();
    expect(screen.getByLabelText(/Должность/i)).toBeInTheDocument();
    expect(screen.getByText("PM")).toBeInTheDocument();
    expect(screen.getByText("Аналитик")).toBeInTheDocument();
  });

  it("renders empty-state instead of selector when positions list is empty", () => {
    setupAuth();
    setupWorkspace(null);
    setupPositions([]);
    renderScreen();
    expect(screen.getByText(/В этом пространстве должностей пока нет/)).toBeInTheDocument();
  });

  it("changes position and PATCHes /members/{mid} {position_id}", async () => {
    setupAuth();
    setupWorkspace(null);
    setupPositions([{ id: 1, name_ru: "PM" }, { id: 2, name_ru: "Дизайнер" }]);
    renderScreen();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/Должность/i), "2");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updatePositionMutate).toHaveBeenCalledWith({ memberId: 50, positionId: 2 });
    });
    expect(apiClient.patch).not.toHaveBeenCalled();  // имена не менялись
  });

  it("sends both PATCHes in parallel when name + position changed", async () => {
    setupAuth();
    setupWorkspace(1);
    setupPositions([{ id: 1, name_ru: "PM" }, { id: 2, name_ru: "Дизайнер" }]);
    renderScreen();

    const user = userEvent.setup();
    const firstNameInput = screen.getByLabelText(/Имя/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Bobur");
    await user.selectOptions(screen.getByLabelText(/Должность/i), "2");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalled();
      expect(updatePositionMutate).toHaveBeenCalledWith({ memberId: 50, positionId: 2 });
    });
  });

  it("clears position via «—» option", async () => {
    setupAuth();
    setupWorkspace(1);
    setupPositions([{ id: 1, name_ru: "PM" }]);
    renderScreen();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/Должность/i), "");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updatePositionMutate).toHaveBeenCalledWith({ memberId: 50, positionId: null });
    });
  });

  it("rejects lowercase first name", async () => {
    setupAuth({ first_name: "alisher" });
    setupWorkspace(null);
    setupPositions([]);
    renderScreen();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(screen.getByText(/Имя — латиница/i)).toBeInTheDocument();
  });

  it("calls onBack on ✕", async () => {
    setupAuth();
    setupWorkspace(null);
    setupPositions([]);
    const onBack = vi.fn();
    renderScreen({ onBack });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Закрыть" }));

    expect(onBack).toHaveBeenCalled();
  });
});
