import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrationScreen } from "../src/components/RegistrationScreen";

describe("RegistrationScreen", () => {
  it("uses default values from props", () => {
    render(
      <RegistrationScreen
        defaultFirstName="Alisher"
        defaultLastName="Rakhimov"
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Имя/i)).toHaveValue("Alisher");
    expect(screen.getByLabelText(/Фамилия/i)).toHaveValue("Rakhimov");
  });

  it("submits with two fields when both valid", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Имя/i), "Alisher");
    await user.type(screen.getByLabelText(/Фамилия/i), "Rakhimov");
    await user.click(
      screen.getByRole("button", { name: /Зарегистрироваться/i })
    );

    expect(onSubmit).toHaveBeenCalledWith("Alisher", "Rakhimov");
  });

  it("trims whitespace before validating", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Имя/i), "  Alisher  ");
    await user.type(screen.getByLabelText(/Фамилия/i), "  Rakhimov  ");
    await user.click(
      screen.getByRole("button", { name: /Зарегистрироваться/i })
    );

    expect(onSubmit).toHaveBeenCalledWith("Alisher", "Rakhimov");
  });

  it("rejects lowercase first name", async () => {
    const onSubmit = vi.fn();
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Имя/i), "alisher");
    await user.type(screen.getByLabelText(/Фамилия/i), "Rakhimov");
    await user.click(
      screen.getByRole("button", { name: /Зарегистрироваться/i })
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Имя — латиница/i)).toBeInTheDocument();
  });

  it("rejects all-caps first name", async () => {
    const onSubmit = vi.fn();
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Имя/i), "ALISHER");
    await user.type(screen.getByLabelText(/Фамилия/i), "Rakhimov");
    await user.click(
      screen.getByRole("button", { name: /Зарегистрироваться/i })
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Имя — латиница/i)).toBeInTheDocument();
  });

  it("rejects cyrillic first name", async () => {
    const onSubmit = vi.fn();
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Имя/i), "Алишер");
    await user.type(screen.getByLabelText(/Фамилия/i), "Rakhimov");
    await user.click(
      screen.getByRole("button", { name: /Зарегистрироваться/i })
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Имя — латиница/i)).toBeInTheDocument();
  });

  it("rejects invalid last name", async () => {
    const onSubmit = vi.fn();
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Имя/i), "Alisher");
    await user.type(screen.getByLabelText(/Фамилия/i), "rakhimov");
    await user.click(
      screen.getByRole("button", { name: /Зарегистрироваться/i })
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Фамилия — латиница/i)).toBeInTheDocument();
  });

  it("shows server error if onSubmit throws", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue({ response: { status: 422, data: { detail: "boom" } } });
    render(<RegistrationScreen onSubmit={onSubmit} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Имя/i), "Alisher");
    await user.type(screen.getByLabelText(/Фамилия/i), "Rakhimov");
    await user.click(
      screen.getByRole("button", { name: /Зарегистрироваться/i })
    );

    await screen.findByText(/\[422\] boom/i);
  });
});
