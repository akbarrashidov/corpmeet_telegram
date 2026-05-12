import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@corpmeet/design/complex", () => ({
  useUsers: vi.fn(),
}));

import { useUsers } from "@corpmeet/design/complex";
import { GuestPicker, type GuestEntry } from "../src/components/GuestPicker";

function mockUsers(
  users: Array<{ id: number; display_name: string; username?: string | null; position?: string | null }>,
) {
  vi.mocked(useUsers).mockReturnValue({
    data: users.map((u) => ({
      id: u.id,
      telegram_id: null,
      username: u.username ?? null,
      first_name: u.display_name.split(" ")[0],
      last_name: u.display_name.split(" ")[1] ?? null,
      role: "user",
      display_name: u.display_name,
      position: u.position ?? null,
    })),
    isLoading: false,
    isFetching: false,
    error: null,
  } as any);
}

function entry(label: string, value: string = label): GuestEntry {
  return { label, value };
}

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

  it("opens dropdown with users on input focus", async () => {
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

  it("adds all users of a position with their usernames", async () => {
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
});
