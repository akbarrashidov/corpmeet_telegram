import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@corpmeet/design/complex", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from "@corpmeet/design/complex";
import { OnboardingScreen } from "../src/pages/OnboardingScreen";

function renderScreen() {
  const onComplete = vi.fn();
  return {
    onComplete,
    ...render(
      <QueryClientProvider client={new QueryClient()}>
        <OnboardingScreen onComplete={onComplete} />
      </QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset();
  vi.mocked(apiClient.post).mockReset();
});

// ──────── Menu ────────

describe("OnboardingScreen — menu", () => {
  it("shows three path options", () => {
    renderScreen();
    expect(screen.getByText(/Создать пространство/i)).toBeInTheDocument();
    expect(screen.getByText(/Войти по коду/i)).toBeInTheDocument();
    expect(screen.getByText(/Найти по названию/i)).toBeInTheDocument();
  });
});

// ──────── Create ────────

describe("OnboardingScreen — create", () => {
  it("opens create form on click", async () => {
    renderScreen();
    await userEvent.setup().click(screen.getByText(/Создать пространство/i));
    expect(screen.getByText("Новое пространство")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Команда Альфа/i)).toBeInTheDocument();
  });

  it("shows error on empty name submit", async () => {
    renderScreen();
    const user = userEvent.setup();
    await user.click(screen.getByText(/Создать пространство/i));
    await user.click(screen.getByRole("button", { name: /Создать/i }));
    expect(screen.getByText(/Введи название/i)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("POST workspace → navigates to room creation step", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } });
    const { onComplete } = renderScreen();
    const user = userEvent.setup();

    await user.click(screen.getByText(/Создать пространство/i));
    await user.type(screen.getByPlaceholderText(/Команда Альфа/i), "My team");
    await user.click(screen.getByRole("button", { name: /Создать/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/workspaces",
        expect.objectContaining({ name: "My team", timezone: "Asia/Tashkent" }),
      );
    });

    // На втором шаге — форма создания комнаты, onComplete ещё не вызван
    expect(await screen.findByText(/Создайте переговорную/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Переговорная/i)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("POST workspace + POST room → calls onComplete", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { id: 42 } }) // workspace
      .mockResolvedValueOnce({ data: { id: 7 } }); // room
    const { onComplete } = renderScreen();
    const user = userEvent.setup();

    await user.click(screen.getByText(/Создать пространство/i));
    await user.type(screen.getByPlaceholderText(/Команда Альфа/i), "Team B");
    await user.click(screen.getByRole("button", { name: /Создать/i }));

    // Дождаться появления экрана комнаты и ввести имя
    await screen.findByText(/Создайте переговорную/i);
    await user.type(screen.getByPlaceholderText(/Переговорная/i), "Main room");
    await user.click(screen.getByRole("button", { name: /Создать/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/rooms",
        expect.objectContaining({ name: "Main room", workspace_id: 42 }),
      );
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("shows error on workspace API failure", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("nope"));
    const { onComplete } = renderScreen();
    const user = userEvent.setup();

    await user.click(screen.getByText(/Создать пространство/i));
    await user.type(screen.getByPlaceholderText(/Команда Альфа/i), "X");
    await user.click(screen.getByRole("button", { name: /Создать/i }));

    await screen.findByText(/Не удалось создать/i);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ──────── Join by code ────────

describe("OnboardingScreen — join by code", () => {
  it("opens join form", async () => {
    renderScreen();
    await userEvent.setup().click(screen.getByText(/Войти по коду/i));
    expect(screen.getByText("Войти по коду")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ABC12345/i)).toBeInTheDocument();
  });

  it("shows error on empty code", async () => {
    renderScreen();
    const user = userEvent.setup();
    await user.click(screen.getByText(/Войти по коду/i));
    await user.click(screen.getByRole("button", { name: /Отправить заявку/i }));
    expect(screen.getByText(/Введи код/i)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("POSTs and shows submitted screen on success", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    renderScreen();
    const user = userEvent.setup();

    await user.click(screen.getByText(/Войти по коду/i));
    await user.type(screen.getByPlaceholderText(/ABC12345/i), "INV123");
    await user.click(screen.getByRole("button", { name: /Отправить заявку/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/workspaces/join",
        { invite_code: "INV123" },
      );
    });
    expect(await screen.findByText(/Заявка отправлена/i)).toBeInTheDocument();
  });
});

// ──────── Search ────────

describe("OnboardingScreen — search", () => {
  it("opens search form with empty_query message", async () => {
    renderScreen();
    await userEvent.setup().click(screen.getByText(/Найти по названию/i));
    expect(screen.getByText("Найти пространство")).toBeInTheDocument();
    expect(screen.getByText(/Введи хотя бы 1 символ/i)).toBeInTheDocument();
  });

  it("GETs /workspaces/search on input and shows results", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        { id: 1, name: "Альфа Inc", slug: "alpha", invite_code: "AAA", timezone: "UTC", telegram_chat_id: null, created_at: "", my_role: null },
      ],
    });
    renderScreen();
    const user = userEvent.setup();
    await user.click(screen.getByText(/Найти по названию/i));
    await user.type(screen.getByPlaceholderText(/Начни вводить/i), "Альфа");

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/v1/workspaces/search",
        { params: { q: "Альфа" } },
      );
    });
    expect(await screen.findByText("Альфа Inc")).toBeInTheDocument();
  });

  it("shows no_results when empty", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    renderScreen();
    const user = userEvent.setup();
    await user.click(screen.getByText(/Найти по названию/i));
    await user.type(screen.getByPlaceholderText(/Начни вводить/i), "zzz");
    expect(await screen.findByText(/Ничего не нашлось/i)).toBeInTheDocument();
  });

  it("joins selected workspace using its invite_code", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        { id: 1, name: "Альфа", slug: "alpha", invite_code: "AAA", timezone: "UTC", telegram_chat_id: null, created_at: "", my_role: null },
      ],
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    renderScreen();
    const user = userEvent.setup();
    await user.click(screen.getByText(/Найти по названию/i));
    await user.type(screen.getByPlaceholderText(/Начни вводить/i), "Аль");
    await screen.findByText("Альфа");
    await user.click(screen.getByRole("button", { name: /Подать заявку/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/workspaces/join",
        { invite_code: "AAA" },
      );
    });
    expect(await screen.findByText(/Заявка отправлена/i)).toBeInTheDocument();
  });
});
