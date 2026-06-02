import { MouseEvent } from "react";
import type { Booking } from "@corpmeet/design/complex";
import { useTranslation } from "../i18n";
import { haptic } from "../lib/haptic";

const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOUR_TICKS = [9, 12, 15, 18, 21];

interface Props {
  /** Брони этой комнаты на выбранную дату (отфильтровано родителем). */
  bookings: Booking[];
  /** YYYY-MM-DD выбранной даты. */
  date: string;
  /** Локальная дата-время старта выбранного слота (datetime-local format). */
  selectedStart: string;
  selectedEnd: string;
  /** Тап по timeline → подставить новый start, сохранить длительность. */
  onTap: (newStart: string, newEnd: string) => void;
}

function localToMinutes(s: string): number {
  const time = s.split("T")[1] ?? "00:00";
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isoToLocalMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToPercent(m: number): number {
  return ((m - START_HOUR * 60) / TOTAL_MINUTES) * 100;
}

function clampPercent(p: number): number {
  return Math.max(0, Math.min(100, p));
}

function minutesToLocalInput(m: number, date: string): string {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const min = (m % 60).toString().padStart(2, "0");
  return `${date}T${h}:${min}`;
}

/**
 * Визуальная полоса 7:00–22:00 с занятыми (красными) интервалами комнаты и
 * прозрачной синей подсветкой выбранного юзером слота. Тап по полосе =
 * подставить start = выбранное время, end = start + текущая длительность.
 * DateTimePicker используется для точной правки уже после тапа.
 */
export function RoomTimeline({
  bookings, date, selectedStart, selectedEnd, onTap,
}: Props) {
  const { t } = useTranslation();

  const selStart = localToMinutes(selectedStart);
  const selEnd = localToMinutes(selectedEnd);
  const selLeft = clampPercent(minutesToPercent(selStart));
  const selRight = clampPercent(minutesToPercent(selEnd));
  const selWidth = Math.max(0, selRight - selLeft);

  const hasOverlap = bookings.some((b) => {
    const bs = isoToLocalMinutes(b.start_time);
    const be = isoToLocalMinutes(b.end_time);
    return selStart < be && selEnd > bs;
  });

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const rawMinute = percent * TOTAL_MINUTES + START_HOUR * 60;
    const rounded = Math.round(rawMinute / 15) * 15;
    const duration = Math.max(15, selEnd - selStart);  // фолбэк 15 мин если что-то странное
    const newStart = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - duration, rounded));
    const newEnd = newStart + duration;
    haptic();
    onTap(
      minutesToLocalInput(newStart, date),
      minutesToLocalInput(newEnd, date),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">{t("timeline.title")}</span>

      {/* Hour labels */}
      <div className="relative h-4">
        {HOUR_TICKS.map((h) => (
          <span
            key={h}
            className="absolute text-xs"
            style={{
              left: `${minutesToPercent(h * 60)}%`,
              transform: "translateX(-50%)",
              color: "var(--text-muted)",
            }}
          >
            {h}:00
          </span>
        ))}
      </div>

      {/* Timeline bar */}
      <div
        role="button"
        aria-label={t("timeline.title")}
        onClick={handleClick}
        className="relative h-10 rounded-lg cursor-pointer overflow-hidden"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
        }}
      >
        {/* Existing bookings */}
        {bookings.map((b) => {
          const bs = isoToLocalMinutes(b.start_time);
          const be = isoToLocalMinutes(b.end_time);
          const left = clampPercent(minutesToPercent(bs));
          const right = clampPercent(minutesToPercent(be));
          const width = right - left;
          if (width <= 0) return null;
          return (
            <div
              key={b.id}
              className="absolute top-0 bottom-0"
              title={b.title}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: hasOverlap ? "rgba(239, 68, 68, 0.85)" : "rgba(239, 68, 68, 0.55)",
                borderLeft: "1px solid rgba(239, 68, 68, 0.9)",
                borderRight: "1px solid rgba(239, 68, 68, 0.9)",
              }}
            />
          );
        })}

        {/* User's selection */}
        {selWidth > 0 && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${selLeft}%`,
              width: `${selWidth}%`,
              background: "rgba(59, 130, 246, 0.35)",
              border: "2px solid rgb(59, 130, 246)",
            }}
          />
        )}
      </div>

      {hasOverlap && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          ⚠️ {t("timeline.overlap")}
        </p>
      )}
    </div>
  );
}
