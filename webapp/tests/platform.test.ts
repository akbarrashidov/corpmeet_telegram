import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TelegramPlatform } from "../src/lib/telegram";
import { getDevice } from "../src/lib/platform";

function mockTelegram(platform: TelegramPlatform | null) {
  if (platform === null) {
    delete (window as any).Telegram;
    return;
  }
  (window as any).Telegram = {
    WebApp: {
      platform,
      initData: "",
      ready: () => {},
      expand: () => {},
      close: () => {},
      openLink: () => {},
    },
  };
}

describe("getDevice", () => {
  beforeEach(() => mockTelegram(null));
  afterEach(() => mockTelegram(null));

  it("returns 'non-telegram' if window.Telegram is missing", () => {
    expect(getDevice()).toBe("non-telegram");
  });

  it.each(["android", "android_x", "ios"] as TelegramPlatform[])(
    "returns 'mobile' for %s",
    (p) => {
      mockTelegram(p);
      expect(getDevice()).toBe("mobile");
    }
  );

  it.each(["macos", "tdesktop", "weba", "webk", "unigram"] as TelegramPlatform[])(
    "returns 'desktop' for %s",
    (p) => {
      mockTelegram(p);
      expect(getDevice()).toBe("desktop");
    }
  );

  it("returns 'desktop' for unknown platform (safe fallback)", () => {
    mockTelegram("unknown");
    expect(getDevice()).toBe("desktop");
  });
});
