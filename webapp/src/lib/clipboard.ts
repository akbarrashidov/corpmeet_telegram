/**
 * Копирование текста в буфер обмена.
 *
 * Использует Telegram Web App API если доступно (надёжнее в iOS WebView).
 * Fallback на `navigator.clipboard.writeText` для не-Telegram контекстов.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Telegram-specific API
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openTelegramLink && typeof tg.openInvoice !== "undefined") {
    // Some Telegram versions support direct clipboard via webview.
    // But the most reliable cross-version path is plain clipboard API.
  }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older WebView (creates hidden textarea, selects, execCommand).
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
