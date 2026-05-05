import { describe, expect, it } from "vitest";
import { findNextFreeSlot, type SlotInput } from "../src/lib/findNextFreeSlot";

const ONE_HOUR_MS = 60 * 60 * 1000;
const HALF_HOUR_MS = 30 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/** "today at 10:00 local" */
const NOW = new Date(2026, 4, 4, 10, 0, 0); // monthIndex 4 = May

function slot(start: string, end: string, available: boolean): SlotInput {
  return { start, end, available };
}

function isoAtTodayLocal(hhmm: string, base: Date = NOW): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

describe("findNextFreeSlot", () => {
  it("returns null on empty slots", () => {
    expect(findNextFreeSlot([], ONE_HOUR_MS, NOW)).toBeNull();
  });

  it("returns null when all slots busy", () => {
    const slots = [
      slot("11:00", "11:30", false),
      slot("11:30", "12:00", false),
    ];
    expect(findNextFreeSlot(slots, ONE_HOUR_MS, NOW)).toBeNull();
  });

  it("ignores available slots in the past", () => {
    const slots = [
      slot("09:00", "09:30", true),
      slot("09:30", "10:00", true), // boundary == now, not > now
    ];
    expect(findNextFreeSlot(slots, ONE_HOUR_MS, NOW)).toBeNull();
  });

  it("uses full original duration when nothing busy after the slot", () => {
    const slots = [slot("11:00", "11:30", true)];
    const plan = findNextFreeSlot(slots, ONE_HOUR_MS, NOW);
    expect(plan).toEqual({
      start: isoAtTodayLocal("11:00"),
      end: isoAtTodayLocal("12:00"),
    });
  });

  it("trims new end to next busy slot start", () => {
    const slots = [
      slot("11:00", "11:30", true),
      slot("11:30", "12:00", true),
      slot("12:00", "12:30", false),
    ];
    const plan = findNextFreeSlot(slots, ONE_HOUR_MS * 2, NOW);
    expect(plan).toEqual({
      start: isoAtTodayLocal("11:00"),
      end: isoAtTodayLocal("12:00"),
    });
  });

  it("picks first future available even if earlier busy slots exist", () => {
    const slots = [
      slot("10:00", "10:30", false),
      slot("10:30", "11:00", false),
      slot("11:00", "11:30", true),
    ];
    const plan = findNextFreeSlot(slots, HALF_HOUR_MS, NOW);
    expect(plan?.start).toBe(isoAtTodayLocal("11:00"));
  });

  it("works regardless of slot order in input", () => {
    const slots = [
      slot("13:00", "13:30", true),
      slot("11:00", "11:30", true),
      slot("12:00", "12:30", false),
    ];
    const plan = findNextFreeSlot(slots, FIFTEEN_MIN_MS, NOW);
    expect(plan?.start).toBe(isoAtTodayLocal("11:00"));
  });

  it("returns short range when next-busy starts soon after chosen slot", () => {
    const slots = [
      slot("11:00", "11:15", true),
      slot("11:15", "11:30", false),
    ];
    const plan = findNextFreeSlot(slots, ONE_HOUR_MS, NOW);
    expect(plan).toEqual({
      start: isoAtTodayLocal("11:00"),
      end: isoAtTodayLocal("11:15"),
    });
  });
});
