import { getTelegram, type TelegramPlatform } from "./telegram";

export type Device = "mobile" | "desktop" | "non-telegram";

const MOBILE: TelegramPlatform[] = ["android", "android_x", "ios"];
const DESKTOP: TelegramPlatform[] = ["macos", "tdesktop", "weba", "webk", "unigram"];

export function getDevice(): Device {
  const tg = getTelegram();
  if (!tg) return "non-telegram";
  if (MOBILE.includes(tg.platform)) return "mobile";
  if (DESKTOP.includes(tg.platform)) return "desktop";
  return "desktop";
}
