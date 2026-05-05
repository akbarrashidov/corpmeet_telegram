/** Чистые функции работы с датами/временем. */

export function todayIso(): string {
  return localIsoDate(new Date());
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localIsoDate(d);
}

function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatDayMonth(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/**
 * Текущее время округлённое до ближайшего получаса вверх,
 * формат для <input type="datetime-local"> ("2026-05-01T14:30").
 */
export function defaultStartLocal(): string {
  const d = new Date();
  const m = d.getMinutes();
  d.setMinutes(m < 30 ? 30 : 60, 0, 0);
  return localDateTime(d);
}

/** +1 час от defaultStartLocal. */
export function defaultEndLocal(): string {
  const d = new Date(defaultStartLocal());
  d.setHours(d.getHours() + 1);
  return localDateTime(d);
}

function localDateTime(d: Date): string {
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const H = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${M}-${D}T${H}:${m}`;
}

/**
 * "2026-05-01T14:30" (local) → ISO с TZ offset.
 * Бэк примет UTC через toISOString — он сам нормализует в свой TZ для хранения.
 */
export function localInputToIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

/**
 * Обратное преобразование `localInputToIso`.
 * "2026-05-04T11:00:00.000Z" → "2026-05-04T11:00" (для <input type="datetime-local">).
 * Использует локальную TZ JS-рантайма.
 */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const H = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${M}-${D}T${H}:${m}`;
}
