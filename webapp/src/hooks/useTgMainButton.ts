import { useEffect, useRef } from "react";
import { getTelegram } from "../lib/telegram";

interface Options {
  text: string;
  onClick: () => void;
  visible?: boolean;
  disabled?: boolean;
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
