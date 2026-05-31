import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@corpmeet/design/complex", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@corpmeet/design/complex";
import { NameWarningBanner } from "../src/components/NameWarningBanner";

function setupUser(overrides: { first_name?: string | null; last_name?: string | null }) {
  const merged = {
    first_name: "Alice" as string | null,
    last_name: "Smith" as string | null,
    ...overrides,
  };
  vi.mocked(useAuth).mockReturnValue({
    user: {
      id: 1,
      first_name: merged.first_name,
      last_name: merged.last_name,
    },
    isLoading: false,
    isAuthenticated: true,
    setToken: vi.fn(),
    logout: vi.fn(),
  } as any);
}

beforeEach(() => {
  vi.mocked(useAuth).mockReset();
});

describe("NameWarningBanner", () => {
  it("renders when first_name is empty", () => {
    setupUser({ first_name: "", last_name: "Smith" });
    render(<NameWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/не заполнено имя или фамилия/i)).toBeInTheDocument();
  });

  it("renders when last_name is null", () => {
    setupUser({ first_name: "Alice", last_name: null });
    render(<NameWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders when both are empty", () => {
    setupUser({ first_name: "", last_name: "" });
    render(<NameWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does NOT render when both first and last are filled", () => {
    setupUser({ first_name: "Alice", last_name: "Smith" });
    render(<NameWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does NOT render when user is undefined", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: undefined,
      isLoading: false,
      isAuthenticated: false,
      setToken: vi.fn(),
      logout: vi.fn(),
    } as any);
    render(<NameWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats whitespace-only as empty", () => {
    setupUser({ first_name: "  ", last_name: "Smith" });
    render(<NameWarningBanner onOpenProfile={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls onOpenProfile on button click", async () => {
    setupUser({ first_name: "", last_name: "Smith" });
    const onOpenProfile = vi.fn();
    render(<NameWarningBanner onOpenProfile={onOpenProfile} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Указать" }));
    expect(onOpenProfile).toHaveBeenCalled();
  });
});
