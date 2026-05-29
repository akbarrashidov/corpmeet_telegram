/**
 * Локальный кэш `invite_deep_link` для pending invites.
 *
 * Backend сейчас возвращает `invite_deep_link` **только** в ответе на POST
 * (создание invite), а в GET `/workspaces/{id}` это поле приходит `null`.
 * Чтобы copy-кнопка работала и после reload — храним ссылки в localStorage
 * по `member.id`.
 *
 * Когда Тимур починит backend (отдаст deep_link в GET) — этот модуль
 * можно будет удалить (или оставить как fallback на случай старой версии).
 */
const STORAGE_KEY = "corpmeet_invite_links";

type Cache = Record<string, string>;

function read(): Cache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function write(cache: Cache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // QuotaExceeded или режим инкогнито — тихо игнорируем
  }
}

export function saveInviteDeepLink(memberId: number, deepLink: string): void {
  const cache = read();
  cache[String(memberId)] = deepLink;
  write(cache);
}

export function getInviteDeepLink(memberId: number): string | null {
  const cache = read();
  return cache[String(memberId)] ?? null;
}

export function removeInviteDeepLink(memberId: number): void {
  const cache = read();
  delete cache[String(memberId)];
  write(cache);
}

/** Для тестов — очистить весь кэш. */
export function _clearInviteCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
