import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../src/lib/currentWorkspace", () => ({
  useCurrentWorkspaceId: vi.fn(() => 10),
  setCurrentWorkspaceId: vi.fn(),
}));

vi.mock("../src/hooks/useWorkspaceDetail", () => ({
  useWorkspaceDetail: vi.fn(),
}));

import { useWorkspaceDetail } from "../src/hooks/useWorkspaceDetail";
import { GuestPicker, type GuestEntry } from "../src/components/GuestPicker";

function mockUsers(
  users: Array<{ id: number; display_name: string; username?: string | null; position?: string | null }>,
) {
  vi.mocked(useWorkspaceDetail).mockReturnValue({
    data: {
      id: 10,
      name: "Test WS",
      slug: "test",
      invite_code: "CODE",
      timezone: "UTC",
      telegram_chat_id: null,
      created_at: "2026-01-01T00:00:00Z",
      my_role: "owner",
      members: users.map((u, i) => ({
        id: 100 + i,
        workspace_id: 10,
        user_id: u.id,
        pending_username: null,
        role: "member" as const,
        status: "active" as const,
        user: {
          id: u.id,
          display_name: u.display_name,
          username: u.username ?? null,
          first_name: u.display_name.split(" ")[0],
          last_name: u.display_name.split(" ")[1] ?? null,
          position: u.position ?? null,
        },
        created_at: "2026-01-01T00:00:00Z",
      })),
      pending_members: [],
    },
    isLoading: false,
  } as any);
}

function entry(label: string, value: string = label): GuestEntry {
  return { label, value };
}

beforeEach(() => {
  vi.mocked(useWorkspaceDetail).mockReset();
});

describe("GuestPicker", () => {
  it("renders chips with labels for each value", () => {
    mockUsers([]);
    render(
      <GuestPicker
        value={[entry("Иван Иванов", "ivan"), entry("Анна Смит", "anna")]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Иван Иванов")).toBeInTheDocument();
    expect(screen.getByText("Анна Смит")).toBeInTheDocument();
  });

  it("removes chip on ✕ click", async () => {
    mockUsers([]);
    const onChange = vi.fn();
    render(
      <GuestPicker
        value={[entry("Иван Иванов", "ivan"), entry("Анна Смит", "anna")]}
        onChange={onChange}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Удалить Иван Иванов"));
    expect(onChange).toHaveBeenCalledWith([entry("Анна Смит", "anna")]);
  });

  it("opens dropdown with workspace members on input focus", async () => {
    mockUsers([
      { id: 1, display_name: "Иван Иванов", username: "ivan" },
      { id: 2, display_name: "Анна Смит", username: "anna" },
    ]);
    render(<GuestPicker value={[]} onChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    expect(screen.getAllByText("Иван Иванов")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Анна Смит")[0]).toBeInTheDocument();
  });

  it("adds user with username as value, display_name as label", async () => {
    mockUsers([{ id: 1, display_name: "Иван Иванов", username: "ivan" }]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    await user.click(screen.getByText("Иван Иванов"));
    expect(onChange).toHaveBeenCalledWith([
      { label: "Иван Иванов", value: "ivan" },
    ]);
  });

  it("falls back to display_name when user has no username", async () => {
    mockUsers([{ id: 1, display_name: "Иван Иванов", username: null }]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    await user.click(screen.getByText("Иван Иванов"));
    expect(onChange).toHaveBeenCalledWith([
      { label: "Иван Иванов", value: "Иван Иванов" },
    ]);
  });

  it("hides already-selected users from dropdown", async () => {
    mockUsers([
      { id: 1, display_name: "Иван Иванов", username: "ivan" },
      { id: 2, display_name: "Анна Смит", username: "anna" },
    ]);
    render(
      <GuestPicker value={[entry("Иван Иванов", "ivan")]} onChange={vi.fn()} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    const list = screen.getByRole("list");
    expect(list).toHaveTextContent("Анна Смит");
    expect(list).not.toHaveTextContent("Иван Иванов");
  });

  it("filters dropdown by query against workspace members only", async () => {
    mockUsers([
      { id: 1, display_name: "Иван Иванов", username: "ivan" },
      { id: 2, display_name: "Анна Смит", username: "anna" },
    ]);
    render(<GuestPicker value={[]} onChange={vi.fn()} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox");
    await user.type(input, "Анна");
    const list = screen.getByRole("list");
    expect(list).toHaveTextContent("Анна Смит");
    expect(list).not.toHaveTextContent("Иван Иванов");
  });

  it("adds manual entry via Enter (label === value)", async () => {
    mockUsers([{ id: 1, display_name: "Иван Иванов", username: "ivan" }]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox");
    await user.type(input, "все PM{enter}");
    expect(onChange).toHaveBeenCalledWith([{ label: "все PM", value: "все PM" }]);
  });

  it("removes last chip on Backspace in empty input", async () => {
    mockUsers([]);
    const onChange = vi.fn();
    render(
      <GuestPicker
        value={[entry("Иван Иванов", "ivan"), entry("Анна Смит", "anna")]}
        onChange={onChange}
      />,
    );
    const user = userEvent.setup();
    const input = screen.getByRole("textbox");
    input.focus();
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenCalledWith([entry("Иван Иванов", "ivan")]);
  });

  // ---------- position filter chips ----------

  it("adds all workspace members of a position with their usernames", async () => {
    mockUsers([
      { id: 1, display_name: "Alisher Rakhimov", username: "alisher", position: "PM" },
      { id: 2, display_name: "Anna Smirnova", username: "anna", position: "PM" },
      { id: 3, display_name: "Boris Petrov", username: "boris", position: "Аналитик" },
    ]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ PM" }));

    expect(onChange).toHaveBeenCalledWith([
      { label: "Alisher Rakhimov", value: "alisher" },
      { label: "Anna Smirnova", value: "anna" },
    ]);
  });

  it("position chip skips already-selected users by value", async () => {
    mockUsers([
      { id: 1, display_name: "Alisher Rakhimov", username: "alisher", position: "PM" },
      { id: 2, display_name: "Anna Smirnova", username: "anna", position: "PM" },
    ]);
    const onChange = vi.fn();
    render(
      <GuestPicker
        value={[{ label: "Alisher Rakhimov", value: "alisher" }]}
        onChange={onChange}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ PM" }));

    expect(onChange).toHaveBeenCalledWith([
      { label: "Alisher Rakhimov", value: "alisher" },
      { label: "Anna Smirnova", value: "anna" },
    ]);
  });

  it("position chip with no matches does nothing", async () => {
    mockUsers([{ id: 1, display_name: "Boris Petrov", username: "boris", position: "Аналитик" }]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ Дизайнеры" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("excludes pending members from suggestion list", async () => {
    // Только active workspace members попадают в picker — pending invites нет
    vi.mocked(useWorkspaceDetail).mockReturnValue({
      data: {
        id: 10,
        name: "Test WS",
        slug: "test",
        invite_code: "CODE",
        timezone: "UTC",
        telegram_chat_id: null,
        created_at: "2026-01-01T00:00:00Z",
        my_role: "owner",
        members: [
          {
            id: 100,
            workspace_id: 10,
            user_id: 1,
            pending_username: null,
            role: "member",
            status: "active",
            user: { id: 1, display_name: "Active User", username: "active",
              first_name: "Active", last_name: "User", position: null },
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            id: 101,
            workspace_id: 10,
            user_id: null,
            pending_username: "pending_user",
            role: "member",
            status: "pending",
            user: null,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        pending_members: [],
      },
      isLoading: false,
    } as any);

    render(<GuestPicker value={[]} onChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    const list = screen.getByRole("list");
    expect(list).toHaveTextContent("Active User");
    expect(list).not.toHaveTextContent("pending_user");
  });
});
