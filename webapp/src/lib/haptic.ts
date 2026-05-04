import { getTelegram } from "./telegram";

/** Тактильный отклик при действии. No-op вне Telegram. */
export function haptic(style: "light" | "medium" | "heavy" = "light"): void {
  getTelegram()?.HapticFeedback.impactOccurred(style);
}

export function hapticSuccess(): void {
  getTelegram()?.HapticFeedback.notificationOccurred("success");
}

export function hapticError(): void {
  getTelegram()?.HapticFeedback.notificationOccurred("error");
}
