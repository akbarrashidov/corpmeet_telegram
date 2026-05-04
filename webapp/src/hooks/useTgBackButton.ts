import { useEffect, useRef } from "react";
import { getTelegram } from "../lib/telegram";

/**
 * Включает TG BackButton (стрелка в шапке) и подписывает onClick.
 * Если onClick null — кнопка прячется.
 */
export function useTgBackButton(onClick: (() => void) | null) {
  const handlerRef = useRef<(() => void) | null>(onClick);
  useEffect(() => {
    handlerRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    const tg = getTelegram();
    if (!tg) return;

    if (!onClick) {
      tg.BackButton.hide();
      return;
    }

    const handler = () => handlerRef.current?.();
    tg.BackButton.onClick(handler);
    tg.BackButton.show();

    return () => {
      tg.BackButton.offClick(handler);
      tg.BackButton.hide();
    };
  }, [onClick !== null]);
}
