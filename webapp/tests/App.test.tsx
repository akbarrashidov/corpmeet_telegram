import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../src/App";

vi.mock("@corpmeet/design/complex", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    createBrowserSession: vi.fn(),
  },
  storage: {
    getToken: vi.fn(() => null),
    setToken: vi.fn(),
    removeToken: vi.fn(),
  },
  useAuth: vi.fn(() => ({
    user: undefined,
    isLoading: false,
    isAuthenticated: false,
    setToken: vi.fn(),
    logout: vi.fn(),
  })),
  useBookings: vi.fn(() => ({ data: [], isLoading: false, isFetching: false, error: null })),
  useActiveBookings: vi.fn(() => ({ data: [], isLoading: false, isFetching: false, error: null })),
  useUsers: vi.fn(() => ({ data: [], isLoading: false, isFetching: false, error: null })),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock("../src/hooks/useInvitedBookings", () => ({
  useInvitedBookings: vi.fn(() => ({ data: [], isLoading: false, isFetching: false, error: null })),
}));

vi.mock("@corpmeet/design/animations", () => ({
  LoadingSpinner: () => <div data-testid="spinner">…</div>,
}));

import { apiClient, authApi, storage } from "@corpmeet/design/complex";

const renderApp = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>
  );

function setTelegram(opts: {
  platform: string;
  initData?: string;
  openLink?: () => void;
  close?: () => void;
}) {
  (window as any).Telegram = {
    WebApp: {
      platform: opts.platform,
      initData: opts.initData ?? "valid-init-data",
      initDataUnsafe: { user: { id: 1 } },
      ready: vi.fn(),
      expand: vi.fn(),
      close: opts.close ?? vi.fn(),
      openLink: opts.openLink ?? vi.fn(),
      MainButton: {
        show: vi.fn(),
        hide: vi.fn(),
        setText: vi.fn(),
        onClick: vi.fn(),
        offClick: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
      },
      BackButton: {
        show: vi.fn(),
        hide: vi.fn(),
        onClick: vi.fn(),
        offClick: vi.fn(),
      },
      HapticFeedback: {
        impactOccurred: vi.fn(),
        notificationOccurred: vi.fn(),
        selectionChanged: vi.fn(),
      },
    },
  };
}

function meWithPosition(overrides: Partial<{ first_name: string; last_name: string; position: string | null }> = {}) {
  return {
    id: 1,
    telegram_id: 100,
    username: null,
    first_name: overrides.first_name ?? "Alisher",
    last_name: overrides.last_name ?? "Rakhimov",
    role: "user" as const,
    display_name: `${overrides.first_name ?? "Alisher"} ${overrides.last_name ?? "Rakhimov"}`,
    position: overrides.position === undefined ? "PM" : overrides.position,
  };
}

function axiosError(status: number) {
  const e: any = new Error("http");
  e.isAxiosError = true;
  e.response = { status };
  return e;
}

describe("App", () => {
  beforeEach(() => {
    vi.mocked(storage.getToken).mockReturnValue(null);
    vi.mocked(storage.setToken).mockClear();
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.register).mockReset();
    vi.mocked(authApi.getMe).mockReset();
    vi.mocked(authApi.createBrowserSession).mockReset();
    vi.mocked(apiClient.patch).mockReset();
  });
  afterEach(() => {
    delete (window as any).Telegram;
  });

  // ---------- Mobile happy path ----------
  it("mobile: login OK + position set → renders HomePage", async () => {
    setTelegram({ platform: "ios" });
    vi.mocked(authApi.login).mockResolvedValue({ access_token: "tok", expires_in: 1000 });
    vi.mocked(authApi.getMe).mockResolvedValue(meWithPosition());

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "День" })).toBeInTheDocument();
    });
    expect(storage.setToken).toHaveBeenCalledWith("tok");
  });

  // ---------- Mobile: logged in but no position → registration with prefill ----------
  it("mobile: login OK + position null → registration prefilled → patch only → HomePage", async () => {
    setTelegram({ platform: "ios" });
    vi.mocked(authApi.login).mockResolvedValue({ access_token: "tok", expires_in: 1000 });
    vi.mocked(authApi.getMe).mockResolvedValue(
      meWithPosition({ first_name: "Alisher", last_name: "Rakhimov", position: null })
    );
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} } as any);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Регистрация/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Имя/i)).toHaveValue("Alisher");
    expect(screen.getByLabelText(/Фамилия/i)).toHaveValue("Rakhimov");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "PM" }));
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    await waitFor(() => {
      expect(authApi.register).not.toHaveBeenCalled();
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/auth/me", {
        first_name: "Alisher",
        last_name: "Rakhimov",
        position: "PM",
      });
      expect(screen.getByRole("button", { name: "День" })).toBeInTheDocument();
    });
  });

  // ---------- Mobile: 404 → fresh registration → register + patch → HomePage ----------
  it("mobile: login 404 → empty registration → register + patch → HomePage", async () => {
    setTelegram({ platform: "ios" });
    vi.mocked(authApi.login).mockRejectedValue(axiosError(404));
    vi.mocked(authApi.register).mockResolvedValue({ access_token: "newtok", expires_in: 1000 });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} } as any);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Регистрация/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Имя/i)).toHaveValue("");
    expect(screen.getByLabelText(/Фамилия/i)).toHaveValue("");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Имя/i), "Alisher");
    await user.type(screen.getByLabelText(/Фамилия/i), "Rakhimov");
    await user.click(screen.getByRole("button", { name: "PM" }));
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith(
        "valid-init-data",
        "Alisher",
        "Rakhimov"
      );
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/auth/me", {
        first_name: "Alisher",
        last_name: "Rakhimov",
        position: "PM",
      });
      expect(screen.getByRole("button", { name: "День" })).toBeInTheDocument();
    });
    expect(storage.setToken).toHaveBeenCalledWith("newtok");
  });

  // ---------- Mobile: empty initData ----------
  it("mobile: empty initData → error screen", async () => {
    setTelegram({ platform: "ios", initData: "" });
    renderApp();
    await waitFor(() => {
      expect(screen.getByText(/Откройте через Telegram/i)).toBeInTheDocument();
    });
    expect(authApi.login).not.toHaveBeenCalled();
  });

  // ---------- Desktop happy path ----------
  it("desktop: login OK + position set → opens browser session URL and closes", async () => {
    const openLink = vi.fn();
    const close = vi.fn();
    setTelegram({ platform: "tdesktop", openLink, close });

    vi.mocked(authApi.login).mockResolvedValue({ access_token: "tok", expires_in: 1000 });
    vi.mocked(authApi.getMe).mockResolvedValue(meWithPosition());
    vi.mocked(authApi.createBrowserSession).mockResolvedValue({
      session_token: "s1",
      browser_url: "/auth/session/s1",
    });

    renderApp();

    await waitFor(() => {
      expect(openLink).toHaveBeenCalledWith("https://corpmeet.uz/auth/session/s1");
      expect(close).toHaveBeenCalled();
    });
  });

  // ---------- Desktop fallback ----------
  it("desktop: createBrowserSession fails → opens plain corpmeet.uz", async () => {
    const openLink = vi.fn();
    const close = vi.fn();
    setTelegram({ platform: "tdesktop", openLink, close });

    vi.mocked(authApi.login).mockResolvedValue({ access_token: "tok", expires_in: 1000 });
    vi.mocked(authApi.getMe).mockResolvedValue(meWithPosition());
    vi.mocked(authApi.createBrowserSession).mockRejectedValue(new Error("nope"));

    renderApp();

    await waitFor(() => {
      expect(openLink).toHaveBeenCalledWith("https://corpmeet.uz");
      expect(close).toHaveBeenCalled();
    });
  });

  // ---------- Desktop registration → redirect ----------
  it("desktop: 404 → registration → register + patch → browser session redirect", async () => {
    const openLink = vi.fn();
    const close = vi.fn();
    setTelegram({ platform: "tdesktop", openLink, close });

    vi.mocked(authApi.login).mockRejectedValue(axiosError(404));
    vi.mocked(authApi.register).mockResolvedValue({ access_token: "tok", expires_in: 1000 });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} } as any);
    vi.mocked(authApi.createBrowserSession).mockResolvedValue({
      session_token: "s2",
      browser_url: "/auth/session/s2",
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Регистрация/i)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Имя/i), "Alisher");
    await user.type(screen.getByLabelText(/Фамилия/i), "Rakhimov");
    await user.click(screen.getByRole("button", { name: "PM" }));
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    await waitFor(() => {
      expect(openLink).toHaveBeenCalledWith("https://corpmeet.uz/auth/session/s2");
      expect(close).toHaveBeenCalled();
    });
  });
});
