import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../src/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("does not render when closed", () => {
    render(<ConfirmDialog open={false} title="X" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText("X")).not.toBeInTheDocument();
  });

  it("renders title and body when open", () => {
    render(
      <ConfirmDialog open title="Title" body="Body text" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="X" onConfirm={onConfirm} onCancel={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when cancel button clicked", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="X" onConfirm={vi.fn()} onCancel={onCancel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
