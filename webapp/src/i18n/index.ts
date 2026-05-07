import { useSyncExternalStore } from "react";
import { ru, type TranslationKey } from "./ru";
import { uz } from "./uz";

export type { TranslationKey } from "./ru";
export type Lang = "ru" | "uz";

const STORAGE_KEY = "corpmeet_lang";
const DEFAULT_LANG: Lang = "ru";
const VALID_LANGS: Lang[] = ["ru", "uz"];

const listeners = new Set<() => void>();

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (VALID_LANGS as string[]).includes(saved)) {
      return saved as Lang;
    }
  } catch {
    // localStorage unavailable — fall through
  }
  return DEFAULT_LANG;
}

export function getLang(): Lang {
  return readLang();
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Достаёт строку по ключу с подстановкой плейсхолдеров `{name}`.
 * Если ключ отсутствует в выбранном языке — fallback на ru.
 */
function translate(
  lang: Lang,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const dict = lang === "uz" ? uz : ru;
  const raw = (dict as Record<string, string | undefined>)[key] ?? ru[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name]) : `{${name}}`
  );
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

export function useTranslation(): {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  lang: Lang;
  setLang: (lang: Lang) => void;
} {
  const lang = useLang();
  return {
    t: (key, vars) => translate(lang, key, vars),
    lang,
    setLang,
  };
}
