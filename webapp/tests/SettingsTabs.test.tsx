import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsTabs } from "../src/components/SettingsTabs";

describe("SettingsTabs", () => {
  it("renders only the tabs passed in", () => {
    render(
      <SettingsTabs
        tabs={["general", "invitations"]}
        current="general"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: "Общее" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Приглашения" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Участники" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Переговорные" })).not.toBeInTheDocument();
  });

  it("marks current tab as aria-selected", () => {
    render(
      <SettingsTabs
        tabs={["general", "invitations", "members", "rooms"]}
        current="invitations"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: "Общее" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Приглашения" })).toHaveAttribute("aria-selected", "true");
  });

  it("calls onChange when an inactive tab is clicked", async () => {
    const onChange = vi.fn();
    render(
      <SettingsTabs
        tabs={["general", "members"]}
        current="general"
        onChange={onChange}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Участники" }));
    expect(onChange).toHaveBeenCalledWith("members");
  });

  it("does not call onChange when the active tab is clicked", async () => {
    const onChange = vi.fn();
    render(
      <SettingsTabs
        tabs={["general", "members"]}
        current="general"
        onChange={onChange}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Общее" }));
    expect(onChange).not.toHaveBeenCalled();
  });
  it("renders badge with count next to tab label", () => {
    render(
      <SettingsTabs
        tabs={["members", "rooms"]}
        current="members"
        onChange={vi.fn()}
        badges={{ members: 3 }}
      />,
    );
    // Текст бейджа виден в DOM
    expect(screen.getByText("3")).toBeInTheDocument();
    // accessibility name таба остаётся "Участники" — getByRole его находит
    expect(screen.getByRole("tab", { name: "Участники" })).toBeInTheDocument();
  });

  it("does NOT render badge when count is 0", () => {
    render(
      <SettingsTabs
        tabs={["members"]}
        current="members"
        onChange={vi.fn()}
        badges={{ members: 0 }}
      />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

});
