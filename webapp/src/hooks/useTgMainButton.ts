import { useEffect, useRef } from "react";
import { getTelegram } from "../lib/telegram";

interface Options {
  text: string;
  onClick: () => void;
  visible?: boolean;
  disabled?: boolean;
}

const FALLBACK_PRIMARY = "#6d28d9";

function readPrimaryColor(): string {
  if (typeof document === "undefined") return FALLBACK_PRIMARY;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  return v || FALLBACK_PRIMARY;
}

/**
 * Управляет TG MainButton: показывает, ставит текст, подписывает onClick.
 * Гарантирует cleanup на unmount и при смене onClick — без дублирования подписок.
 *
 * Если открыто не в Telegram — no-op. Компоненты должны рендерить HTML-fallback.
 */
export function useTgMainButton({ text, onClick, visible = true, disabled = false }: Options) {
  // Свежий ref для onClick, чтобы не пересоздавать подписку при смене handler-а
  const handlerRef = useRef(onClick);
  useEffect(() => {
    handlerRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    const tg = getTelegram();
    if (!tg) return;

    const handler = () => handlerRef.current();
    tg.MainButton.setText(text);
    // Match brand --primary (фиолетовый), а не дефолтный синий тематики Telegram.
    tg.MainButton.setParams?.({
      color: readPrimaryColor(),
      text_color: "#ffffff",
    });
    tg.MainButton.onClick(handler);
    if (visible) tg.MainButton.show();
    else tg.MainButton.hide();
    if (disabled) tg.MainButton.disable();
    else tg.MainButton.enable();

    return () => {
      tg.MainButton.offClick(handler);
      tg.MainButton.hide();
    };
  }, [text, visible, disabled]);
}
