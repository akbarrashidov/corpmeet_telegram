import { useEffect, useState } from "react";
import axios from "axios";
import { apiClient, authApi, storage, type User } from "@corpmeet/design/complex";
import { LoadingScreen } from "./components/LoadingScreen";
import { RegistrationScreen } from "./components/RegistrationScreen";
import { HomeContainer } from "./pages/HomeContainer";
import { getDevice, type Device } from "./lib/platform";
import { getTelegram } from "./lib/telegram";

const DESKTOP_FALLBACK_URL = "https://corpmeet.uz";

type Phase =
  | { kind: "init" }
  | { kind: "needs_registration"; alreadyAuthed: boolean; prefill: { firstName: string; lastName: string } }
  | { kind: "redirecting" }
  | { kind: "ready" }
  | { kind: "error"; error: string };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: "init" });
  const [device, setDevice] = useState<Device>("non-telegram");

  useEffect(() => {
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    const tg = getTelegram();
    if (tg) {
      tg.ready();
      tg.expand();
    }

    const dev = getDevice();
    setDevice(dev);

    if (dev === "non-telegram") {
      window.location.replace(DESKTOP_FALLBACK_URL);
      return;
    }

    if (!tg!.initData) {
      setPhase({ kind: "error", error: "Откройте через Telegram" });
      return;
    }

    try {
      const loginPromise = authApi.login(tg!.initData);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Login timeout 10s")), 10000)
      );
      const { access_token } = await Promise.race([loginPromise, timeoutPromise]);
      storage.setToken(access_token);

      // Проверяем, заполнена ли должность. Если нет — экран регистрации с prefilled.
      const me = await authApi.getMe();
      if (!me.position) {
        setPhase({
          kind: "needs_registration",
          alreadyAuthed: true,
          prefill: {
            firstName: me.first_name ?? "",
            lastName: me.last_name ?? "",
          },
        });
        return;
      }

      await onAuthSuccess(dev);
    } catch (e: any) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setPhase({
          kind: "needs_registration",
          alreadyAuthed: false,
          prefill: { firstName: "", lastName: "" },
        });
      } else {
        const status = axios.isAxiosError(e) ? e.response?.status ?? "?" : "?";
        const detail = axios.isAxiosError(e) ? e.response?.data?.detail : null;
        const msg =
          typeof detail === "string"
            ? `[${status}] ${detail}`
            : detail !== undefined
              ? `[${status}] ${JSON.stringify(detail).slice(0, 200)}`
              : `Сеть/Таймаут: ${e?.message ?? "unknown"}`;
        setPhase({ kind: "error", error: msg });
      }
    }
  }

  async function handleRegister(
    firstName: string,
    lastName: string,
    position: string,
  ) {
    const tg = getTelegram();
    if (!tg) return;

    const alreadyAuthed = phase.kind === "needs_registration" && phase.alreadyAuthed;

    if (!alreadyAuthed) {
      const { access_token } = await authApi.register(
        tg.initData,
        firstName,
        lastName,
      );
      storage.setToken(access_token);
    }

    await apiClient.patch<User>("/api/v1/auth/me", {
      first_name: firstName,
      last_name: lastName,
      position,
    });

    await onAuthSuccess(device);
  }

  async function onAuthSuccess(dev: Device) {
    if (dev === "desktop") {
      setPhase({ kind: "redirecting" });
      await runDesktopRedirect();
    } else {
      setPhase({ kind: "ready" });
    }
  }

  async function runDesktopRedirect() {
    const tg = getTelegram();
    if (!tg) return;
    try {
      const { browser_url } = await authApi.createBrowserSession();
      const fullUrl = browser_url.startsWith("http")
        ? browser_url
        : `${DESKTOP_FALLBACK_URL}${browser_url}`;
      tg.openLink(fullUrl);
      setTimeout(() => tg.close(), 500);
    } catch {
      tg.openLink(DESKTOP_FALLBACK_URL);
      setTimeout(() => tg.close(), 500);
    }
  }

  if (phase.kind === "init") return <LoadingScreen message="Подключаемся…" />;
  if (phase.kind === "redirecting")
    return <LoadingScreen message="Открываем CorpMeet в браузере…" />;
  if (phase.kind === "needs_registration")
    return (
      <RegistrationScreen
        defaultFirstName={phase.prefill.firstName}
        defaultLastName={phase.prefill.lastName}
        onSubmit={handleRegister}
      />
    );
  if (phase.kind === "error") {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 text-center"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <p>{phase.error}</p>
      </div>
    );
  }

  return <HomeContainer />;
}
