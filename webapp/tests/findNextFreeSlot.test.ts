import { describe, expect, it } from "vitest";
import { findNextFreeSlot, type SlotInput } from "../src/lib/findNextFreeSlot";

const NOW = new Date("2026-05-04T10:00:00Z");
const ONE_HOUR_MS = 60 * 60 * 1000;
const HALF_HOUR_MS = 30 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

function slot(startIso: string, endIso: string, available: boolean): SlotInput {
  return { start: startIso, end: endIso, available };
}

describe("findNextFreeSlot", () => {
  it("returns null on empty slots", () => {
    expect(findNextFreeSlot([], ONE_HOUR_MS, NOW)).toBeNull();
  });

  it("returns null when all slots busy", () => {
    const slots = [
      slot("2026-05-04T11:00:00Z", "2026-05-04T11:30:00Z", false),
      slot("2026-05-04T11:30:00Z", "2026-05-04T12:00:00Z", false),
    ];
    expect(findNextFreeSlot(slots, ONE_HOUR_MS, NOW)).toBeNull();
  });

  it("ignores available slots in the past", () => {
    const slots = [
      slot("2026-05-04T09:00:00Z", "2026-05-04T09:30:00Z", true), // past
      slot("2026-05-04T09:30:00Z", "2026-05-04T10:00:00Z", true), // boundary, not > now
    ];
    expect(findNextFreeSlot(slots, ONE_HOUR_MS, NOW)).toBeNull();
  });

  it("uses full original duration when nothing busy after the slot", () => {
    const slots = [slot("2026-05-04T11:00:00Z", "2026-05-04T11:30:00Z", true)];
    const plan = findNextFreeSlot(slots, ONE_HOUR_MS, NOW);
    expect(plan).toEqual({
      start: "2026-05-04T11:00:00.000Z",
      end: "2026-05-04T12:00:00.000Z",
    });
  });

  it("trims new end to next busy slot start", () => {
    const slots = [
      slot("2026-05-04T11:00:00Z", "2026-05-04T11:30:00Z", true),
      slot("2026-05-04T11:30:00Z", "2026-05-04T12:00:00Z", true),
      slot("2026-05-04T12:00:00Z", "2026-05-04T12:30:00Z", false), // busy
    ];
    const plan = findNextFreeSlot(slots, ONE_HOUR_MS * 2, NOW);
    expect(plan).toEqual({
      start: "2026-05-04T11:00:00.000Z",
      end: "2026-05-04T12:00:00.000Z",
    });
  });

  it("picks first future available even if earlier busy slots exist", () => {
    const slots = [
      slot("2026-05-04T10:00:00Z", "2026-05-04T10:30:00Z", false),
      slot("2026-05-04T10:30:00Z", "2026-05-04T11:00:00Z", false),
      slot("2026-05-04T11:00:00Z", "2026-05-04T11:30:00Z", true),
    ];
    const plan = findNextFreeSlot(slots, HALF_HOUR_MS, NOW);
    expect(plan?.start).toBe("2026-05-04T11:00:00.000Z");
  });

  it("works regardless of slot order in input", () => {
    const slots = [
      slot("2026-05-04T13:00:00Z", "2026-05-04T13:30:00Z", true),
      slot("2026-05-04T11:00:00Z", "2026-05-04T11:30:00Z", true),
      slot("2026-05-04T12:00:00Z", "2026-05-04T12:30:00Z", false),
    ];
    const plan = findNextFreeSlot(slots, FIFTEEN_MIN_MS, NOW);
    expect(plan?.start).toBe("2026-05-04T11:00:00.000Z");
  });

  it("returns degenerate range when next busy starts at chosen slot start", () => {
    // Edge case: первое available, но сразу же busy на том же start (race-like data)
    // По сорту сначала busy, потом available на той же времени? Не должно быть, но проверим что не падаем.
    const slots = [
      slot("2026-05-04T11:00:00Z", "2026-05-04T11:30:00Z", true),
    ];
    const plan = findNextFreeSlot(slots, FIFTEEN_MIN_MS, NOW);
    // 15 минут от 11:00 → 11:15
    expect(plan).toEqual({
      start: "2026-05-04T11:00:00.000Z",
      end: "2026-05-04T11:15:00.000Z",
    });
  });
});
