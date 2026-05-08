import { useEffect, useMemo, useRef } from "react";
import { addDaysIso, formatDayMonth, formatDayShort, todayIso } from "../lib/datetime";

interface Props {
  selectedDate: string;
  onChange: (next: string) => void;
  daysBack?: number;
  daysForward?: number;
  /** ISO-даты (YYYY-MM-DD), на которые есть бронирования — отмечаются точкой. */
  markedDates?: Set<string>;
}

export function DateStrip({
  selectedDate,
  onChange,
  daysBack = 3,
  daysForward = 30,
  markedDates,
}: Props) {
  const today = todayIso();
  const selectedRef = useRef<HTMLButtonElement>(null);

  const dates = useMemo(() => {
    const result: string[] = [];
    for (let i = -daysBack; i <= daysForward; i++) {
      result.push(addDaysIso(today, i));
    }
    return result;
  }, [today, daysBack, daysForward]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedDate]);

  return (
    <ul className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scroll-smooth">
      {dates.map((date) => {
        const isSelected = date === selectedDate;
        const isToday = date === today;
        const isMarked = markedDates?.has(date) ?? false;
        const dayNumber = Number(date.slice(8, 10));
        const style = isSelected
          ? { background: "var(--primary)", color: "white" }
          : {
              background: "var(--input-bg)",
              color: "var(--text)",
              border: isToday
                ? "1px solid var(--primary)"
                : "1px solid var(--input-border)",
            };
        return (
          <li key={date} className="flex-shrink-0">
            <button
              ref={isSelected ? selectedRef : undefined}
              type="button"
              onClick={() => onChange(date)}
              aria-pressed={isSelected}
              aria-label={formatDayMonth(date)}
              className="flex flex-col items-center justify-center w-14 py-2 rounded-2xl transition-colors"
              style={style}
            >
              <span className="text-xs opacity-80">{formatDayShort(date)}</span>
              <span className="text-lg font-bold leading-tight">{dayNumber}</span>
              <span
                aria-hidden="true"
                className="block w-1.5 h-1.5 rounded-full mt-0.5"
                style={{
                  background: isMarked
                    ? isSelected ? "white" : "var(--primary)"
                    : "transparent",
                }}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
