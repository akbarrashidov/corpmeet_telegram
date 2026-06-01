import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderWithQuery(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  );
}

import React from "react";

vi.mock("../src/hooks/useCurrentWorkspace", () => ({
  useCurrentWorkspace: vi.fn(),
}));

import { useCurrentWorkspace } from "../src/hooks/useCurrentWorkspace";
import { WorkspaceSelector } from "../src/components/WorkspaceSelector";
import type { Workspace } from "@corpmeet/design/complex";

function makeWs(over: Partial<Workspace> = {}): Workspace {
  return {
    id: 1,
    name: "Альфа",
    slug: "alpha",
    invite_code: "AAA",
    timezone: "UTC",
    telegram_chat_id: null,
    created_at: "",
    my_role: "owner",
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(useCurrentWorkspace).mockReset();
});

describe("WorkspaceSelector", () => {
  it("renders nothing when no workspace selected", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      current: null,
      workspaces: [],
      selectWorkspace: vi.fn(),
      isLoading: false,
    });
    const { container } = render(<WorkspaceSelector onOpenSettings={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows current workspace name", () => {
    const ws = makeWs({ name: "Альфа Inc" });
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      current: ws,
      workspaces: [ws],
      selectWorkspace: vi.fn(),
      isLoading: false,
    });
    render(<WorkspaceSelector onOpenSettings={() => {}} />);
    expect(screen.getByText("Альфа Inc")).toBeInTheDocument();
  });
  it("always shows chevron (clickable to create new)", () => {
    const ws = makeWs();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      current: ws,
      workspaces: [ws],
      selectWorkspace: vi.fn(),
      isLoading: false,
    });
    render(<WorkspaceSelector onOpenSettings={() => {}} />);
    expect(screen.getByText("▾")).toBeInTheDocument();
  });

  it("shows chevron when 2+ workspaces", () => {
    const ws1 = makeWs({ id: 1, name: "A" });
    const ws2 = makeWs({ id: 2, name: "B" });
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      current: ws1,
      workspaces: [ws1, ws2],
      selectWorkspace: vi.fn(),
      isLoading: false,
    });
    render(<WorkspaceSelector onOpenSettings={() => {}} />);
    expect(screen.getByText("▾")).toBeInTheDocument();
  });

  it("opens modal with list on click", async () => {
    const ws1 = makeWs({ id: 1, name: "Альфа" });
    const ws2 = makeWs({ id: 2, name: "Бета" });
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      current: ws1,
      workspaces: [ws1, ws2],
      selectWorkspace: vi.fn(),
      isLoading: false,
    });
    render(<WorkspaceSelector onOpenSettings={() => {}} />);
    await userEvent.setup().click(screen.getByText("Альфа"));
    expect(screen.getByText(/Выбрать пространство/i)).toBeInTheDocument();
    // Бета — в списке модалки
    expect(screen.getAllByText("Бета").length).toBeGreaterThan(0);
  });

  it("calls selectWorkspace when picking", async () => {
    const ws1 = makeWs({ id: 1, name: "Альфа" });
    const ws2 = makeWs({ id: 2, name: "Бета" });
    const selectWorkspace = vi.fn();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      current: ws1,
      workspaces: [ws1, ws2],
      selectWorkspace,
      isLoading: false,
    });
    render(<WorkspaceSelector onOpenSettings={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Альфа")); // open modal
    await user.click(screen.getByText("Бета"));   // pick Beta
    expect(selectWorkspace).toHaveBeenCalledWith(2);
  });
  it("opens create form on '+ Создать новое' click", async () => {
    const ws = makeWs();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      current: ws,
      workspaces: [ws],
      selectWorkspace: vi.fn(),
      isLoading: false,
    });
    renderWithQuery(<WorkspaceSelector onOpenSettings={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Альфа")); // open modal
    await user.click(screen.getByRole("button", { name: /Создать новое/i }));
    expect(screen.getByText("Новое пространство")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Команда Альфа/i)).toBeInTheDocument();
  });

});
