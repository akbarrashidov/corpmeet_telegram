import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../src/App";

vi.mock("@corpmeet/design/complex", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    createBrowserSession: vi.fn(),
    getMe: vi.fn(),
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
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../src/hooks/useInvitedBookings", () => ({
  useInvitedBookings: vi.fn(() => ({ data: [], isLoading: false, isFetching: false, error: null })),
}));

vi.mock("@corpmeet/design/animations", () => ({
  LoadingSpinner: () => <div data-testid="spinner">…</div>,
}));

import { authApi, storage } from "@corpmeet/design/complex";

const renderApp = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>
  );

function setTelegram(opts: {
  platform: string;
  initData?: string;
  user?: { first_name?: string; last_name?: string };
  openLink?: () => void;
  close?: () => void;
}) {
  (window as any).Telegram = {
    WebApp: {
      platform: opts.platform,
      initData: opts.initData ?? "valid-init-data",
      initDataUnsafe: {
        user: { id: 1, ...(opts.user ?? { first_name: "Anna", last_name: "S" }) },
      },
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
    vi.mocked(authApi.createBrowserSession).mockReset();
  });
  afterEach(() => {
    delete (window as any).Telegram;
  });

  // ---------- Mobile happy path ----------
  it("mobile: login OK → renders HomePage", async () => {
    setTelegram({ platform: "ios" });
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: "tok",
      expires_in: 1000,
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "День" })).toBeInTheDocument();
    });
    expect(storage.setToken).toHaveBeenCalledWith("tok");
  });

  // ---------- Mobile registration flow ----------
  it("mobile: login 404 → registration screen → register OK → HomePage", async () => {
    setTelegram({
      platform: "ios",
      user: { first_name: "Anna", last_name: "Smith" },
    });
    vi.mocked(authApi.login).mockRejectedValue(axiosError(404));
    vi.mocked(authApi.register).mockResolvedValue({
      access_token: "newtok",
      expires_in: 1000,
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Регистрация/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Имя/i)).toHaveValue("Anna");
    expect(screen.getByLabelText(/Фамилия/i)).toHaveValue("Smith");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith("valid-init-data", "Anna", "Smith");
      expect(screen.getByRole("button", { name: "День" })).toBeInTheDocument();
    });
    expect(storage.setToken).toHaveBeenCalledWith("newtok");
  });

  // ---------- Mobile login error ----------
  it("mobile: empty initData → error screen", async () => {
    setTelegram({ platform: "ios", initData: "" });
    renderApp();
    await waitFor(() => {
      expect(screen.getByText(/Откройте через Telegram/i)).toBeInTheDocument();
    });
    expect(authApi.login).not.toHaveBeenCalled();
  });

  // ---------- Desktop happy path ----------
  it("desktop: login OK → opens browser session URL and closes", async () => {
    const openLink = vi.fn();
    const close = vi.fn();
    setTelegram({ platform: "tdesktop", openLink, close });

    vi.mocked(authApi.login).mockResolvedValue({
      access_token: "tok",
      expires_in: 1000,
    });
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

    vi.mocked(authApi.login).mockResolvedValue({
      access_token: "tok",
      expires_in: 1000,
    });
    vi.mocked(authApi.createBrowserSession).mockRejectedValue(new Error("nope"));

    renderApp();

    await waitFor(() => {
      expect(openLink).toHaveBeenCalledWith("https://corpmeet.uz");
      expect(close).toHaveBeenCalled();
    });
  });

  // ---------- Desktop registration → redirect ----------
  it("desktop: 404 → registration → register OK → browser session redirect", async () => {
    const openLink = vi.fn();
    const close = vi.fn();
    setTelegram({
      platform: "tdesktop",
      user: { first_name: "Anna", last_name: "Smith" },
      openLink,
      close,
    });

    vi.mocked(authApi.login).mockRejectedValue(axiosError(404));
    vi.mocked(authApi.register).mockResolvedValue({
      access_token: "tok",
      expires_in: 1000,
    });
    vi.mocked(authApi.createBrowserSession).mockResolvedValue({
      session_token: "s2",
      browser_url: "/auth/session/s2",
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Регистрация/i)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Зарегистрироваться/i }));

    await waitFor(() => {
      expect(openLink).toHaveBeenCalledWith("https://corpmeet.uz/auth/session/s2");
      expect(close).toHaveBeenCalled();
    });
  });
});
