import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrationScreen } from "../src/components/RegistrationScreen";

function setTelegramUser(user?: { first_name?: string; last_name?: string }) {
  (window as any).Telegram = {
    WebApp: {
      platform: "ios",
      initData: "init",
      initDataUnsafe: { user: user ? { id: 1, ...user } : undefined },
      ready: () => {},
      expand: () => {},
      close: () => {},
      openLink: () => {},
    },
  };
}

describe("RegistrationScreen", () => {
  beforeEach(() => setTelegramUser({ first_name: "Иван", last_name: "Иванов" }));
  afterEach(() => delete (window as any).Telegram);

  it("prefills name from Telegram initData", () => {
    render(<RegistrationScreen onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Имя/i)).toHaveValue("Иван");
    expect(screen.getByLabelText(/Фамилия/i)).toHaveValue("Иванов");
  });

  it("calls onSubmit with trimmed values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    setTelegramUser({ first_name: "  Анна  ", last_name: "  Смит " });
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    expect(onSubmit).toHaveBeenCalledWith("Анна", "Смит");
  });

  it("blocks submit if either field is empty", async () => {
    const onSubmit = vi.fn();
    setTelegramUser({ first_name: "", last_name: "" });
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Заполни оба поля/i)).toBeInTheDocument();
  });

  it("shows error if onSubmit throws (422 from server)", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("422"));
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    // wait for re-render
    await screen.findByText(/Сеть: 422/i);
  });
});
