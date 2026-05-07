import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@corpmeet/design/complex", () => ({
  useUsers: vi.fn(),
}));

import { useUsers } from "@corpmeet/design/complex";
import { GuestPicker } from "../src/components/GuestPicker";

function mockUsers(
  users: Array<{ id: number; display_name: string; position?: string | null }>
) {
  vi.mocked(useUsers).mockReturnValue({
    data: users.map((u) => ({
      id: u.id,
      telegram_id: null,
      username: null,
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

describe("GuestPicker", () => {
  it("renders chips for each value", () => {
    mockUsers([]);
    render(<GuestPicker value={["Иван Иванов", "Анна Смит"]} onChange={vi.fn()} />);
    expect(screen.getByText("Иван Иванов")).toBeInTheDocument();
    expect(screen.getByText("Анна Смит")).toBeInTheDocument();
  });

  it("removes chip on ✕ click", async () => {
    mockUsers([]);
    const onChange = vi.fn();
    render(<GuestPicker value={["Иван Иванов", "Анна Смит"]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Удалить Иван Иванов"));
    expect(onChange).toHaveBeenCalledWith(["Анна Смит"]);
  });

  it("opens dropdown with users on input focus", async () => {
    mockUsers([
      { id: 1, display_name: "Иван Иванов" },
      { id: 2, display_name: "Анна Смит" },
    ]);
    render(<GuestPicker value={[]} onChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    expect(screen.getAllByText("Иван Иванов")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Анна Смит")[0]).toBeInTheDocument();
  });

  it("adds user on dropdown click", async () => {
    mockUsers([{ id: 1, display_name: "Иван Иванов" }]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    await user.click(screen.getByText("Иван Иванов"));
    expect(onChange).toHaveBeenCalledWith(["Иван Иванов"]);
  });

  it("hides already-selected users from dropdown", async () => {
    mockUsers([
      { id: 1, display_name: "Иван Иванов" },
      { id: 2, display_name: "Анна Смит" },
    ]);
    render(<GuestPicker value={["Иван Иванов"]} onChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox"));
    const list = screen.getByRole("list");
    expect(list).toHaveTextContent("Анна Смит");
    expect(list).not.toHaveTextContent("Иван Иванов");
  });

  it("adds manual entry via Enter for free-text not in dropdown", async () => {
    mockUsers([{ id: 1, display_name: "Иван Иванов" }]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox");
    await user.type(input, "все PM{enter}");
    expect(onChange).toHaveBeenCalledWith(["все PM"]);
  });

  it("removes last chip on Backspace in empty input", async () => {
    mockUsers([]);
    const onChange = vi.fn();
    render(<GuestPicker value={["Иван Иванов", "Анна Смит"]} onChange={onChange} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox");
    input.focus();
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenCalledWith(["Иван Иванов"]);
  });

  // ---------- position filter chips ----------

  it("adds all users of a position when position chip clicked", async () => {
    mockUsers([
      { id: 1, display_name: "Alisher Rakhimov", position: "PM" },
      { id: 2, display_name: "Anna Smirnova", position: "PM" },
      { id: 3, display_name: "Boris Petrov", position: "Аналитик" },
    ]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ PM" }));

    expect(onChange).toHaveBeenCalledWith(["Alisher Rakhimov", "Anna Smirnova"]);
  });

  it("position chip skips already-selected users", async () => {
    mockUsers([
      { id: 1, display_name: "Alisher Rakhimov", position: "PM" },
      { id: 2, display_name: "Anna Smirnova", position: "PM" },
    ]);
    const onChange = vi.fn();
    render(<GuestPicker value={["Alisher Rakhimov"]} onChange={onChange} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ PM" }));

    expect(onChange).toHaveBeenCalledWith(["Alisher Rakhimov", "Anna Smirnova"]);
  });

  it("position chip with no matches does nothing", async () => {
    mockUsers([{ id: 1, display_name: "Boris Petrov", position: "Аналитик" }]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ Дизайнеры" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("position chip filters by exact api-value (Программист и др.)", async () => {
    mockUsers([
      { id: 1, display_name: "Dev One", position: "Программист и др." },
      { id: 2, display_name: "Dev Two", position: "Программист и др." },
      { id: 3, display_name: "Other Person", position: "PM" },
    ]);
    const onChange = vi.fn();
    render(<GuestPicker value={[]} onChange={onChange} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ Программисты и др." }));

    expect(onChange).toHaveBeenCalledWith(["Dev One", "Dev Two"]);
  });
});
