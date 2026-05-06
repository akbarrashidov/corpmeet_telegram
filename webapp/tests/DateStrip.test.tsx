import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateStrip } from "../src/components/DateStrip";
import { addDaysIso, todayIso } from "../src/lib/datetime";

describe("DateStrip", () => {
  it("renders daysBack + 1 + daysForward items", () => {
    render(
      <DateStrip
        selectedDate={todayIso()}
        onChange={vi.fn()}
        daysBack={2}
        daysForward={2}
      />
    );
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("marks exactly one button as aria-pressed", () => {
    render(
      <DateStrip
        selectedDate={todayIso()}
        onChange={vi.fn()}
        daysBack={1}
        daysForward={1}
      />
    );
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
  });

  it("calls onChange with picked date when clicked", async () => {
    const onChange = vi.fn();
    const today = todayIso();
    const tomorrow = addDaysIso(today, 1);
    render(
      <DateStrip
        selectedDate={today}
        onChange={onChange}
        daysBack={0}
        daysForward={2}
      />
    );
    const user = userEvent.setup();
    // [today, tomorrow, +2]: tomorrow — second button
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[1]);
    expect(onChange).toHaveBeenCalledWith(tomorrow);
  });
});
