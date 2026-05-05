/** Pure helper to compute next free reschedule slot from /api/v1/slots response. */

export interface SlotInput {
  /** "HH:MM" — local time of the booking system, anchored to today. */
  start: string;
  end: string;
  available: boolean;
}

export interface ReschedulePlan {
  /** ISO datetime in UTC. */
  start: string;
  end: string;
}

function combineDateAndHHMM(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const result = new Date(date);
  result.setHours(h, m, 0, 0);
  return result;
}

/**
 * Находит первый available-слот с start > now (по сегодняшней дате локально).
 * Новое end = start + originalDurationMs, обрезается до следующего busy.
 * Возвращает null если в slots нет ни одного будущего available.
 */
export function findNextFreeSlot(
  slots: SlotInput[],
  originalDurationMs: number,
  now: Date = new Date()
): ReschedulePlan | null {
  const nowMs = now.getTime();
  const sorted = slots
    .map((s) => ({
      ...s,
      startMs: combineDateAndHHMM(now, s.start).getTime(),
    }))
    .sort((a, b) => a.startMs - b.startMs);

  const firstFree = sorted.find((s) => s.available && s.startMs > nowMs);
  if (!firstFree) return null;

  const newStartMs = firstFree.startMs;
  const desiredEndMs = newStartMs + originalDurationMs;

  const nextBusy = sorted.find((s) => !s.available && s.startMs > newStartMs);
  const cap = nextBusy ? nextBusy.startMs : Infinity;

  const finalEndMs = Math.min(desiredEndMs, cap);

  return {
    start: new Date(newStartMs).toISOString(),
    end: new Date(finalEndMs).toISOString(),
  };
}
