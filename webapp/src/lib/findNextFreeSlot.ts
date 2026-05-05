/** Pure helper to compute next free reschedule slot from /api/v1/slots response. */

export interface SlotInput {
  start: string;
  end: string;
  available: boolean;
}

export interface ReschedulePlan {
  start: string;
  end: string;
}

/**
 * Находит первый available-слот с start > now.
 * Новое end = start + originalDurationMs, но обрезается до следующего busy-слота.
 * Возвращает null если в slots нет ни одного будущего available.
 */
export function findNextFreeSlot(
  slots: SlotInput[],
  originalDurationMs: number,
  now: Date = new Date()
): ReschedulePlan | null {
  const nowMs = now.getTime();
  const sorted = [...slots].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const firstFree = sorted.find(
    (s) => s.available && new Date(s.start).getTime() > nowMs
  );
  if (!firstFree) return null;

  const newStartMs = new Date(firstFree.start).getTime();
  const desiredEndMs = newStartMs + originalDurationMs;

  const nextBusy = sorted.find(
    (s) => !s.available && new Date(s.start).getTime() > newStartMs
  );
  const cap = nextBusy ? new Date(nextBusy.start).getTime() : Infinity;

  const finalEndMs = Math.min(desiredEndMs, cap);

  return {
    start: new Date(newStartMs).toISOString(),
    end: new Date(finalEndMs).toISOString(),
  };
}
