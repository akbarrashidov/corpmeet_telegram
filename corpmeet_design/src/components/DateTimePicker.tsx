import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "../theme/ThemeContext";

/**
 * NOTE: month/day labels are currently hardcoded in Russian (ru-RU).
 * Localize via fork or by parameterizing MONTHS_NOM/DAYS as props if needed.
 */

function pad(n: number) { return String(n).padStart(2, "0"); }

const MONTHS_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAYS       = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const HOUR_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 7);
const MIN_OPTIONS  = Array.from({ length: 12 }, (_, i) => i * 5);

export interface DateTimePickerProps {
  label: string;
  /** "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD" when dateOnly */
  value: string;
  onChange: (v: string) => void;
  dateOnly?: boolean;
}

export function DateTimePicker({ label, value, onChange, dateOnly }: DateTimePickerProps) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerRef  = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hourColRef  = useRef<HTMLDivElement>(null);
  const minColRef   = useRef<HTMLDivElement>(null);

  const [datePart, rawTime] = value ? (dateOnly ? [value, "00:00"] : value.split("T")) : ["", "09:00"];
  const timePart = rawTime || "09:00";
  const [sy, sm, sd] = datePart ? datePart.split("-").map(Number) : [0, 0, 0];
  const [sh, smin]   = timePart.split(":").map(Number);

  const [viewYear,  setViewYear]  = useState(() => sy || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => sm ? sm - 1 : new Date().getMonth());

  useEffect(() => {
    if (sy) setViewYear(sy);
    if (sm) setViewMonth(sm - 1);
  }, [sy, sm]);

  const [pos, setPos] = useState({ top: 0, left: 0, above: false });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < 310;
    setPos({ top: above ? rect.top - 4 : rect.bottom + 6, left: rect.left, above });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      const hEl = hourColRef.current?.querySelector("[data-sel='true']") as HTMLElement | null;
      hEl?.scrollIntoView({ block: "center", behavior: "instant" });
      const mEl = minColRef.current?.querySelector("[data-msel='true']") as HTMLElement | null;
      mEl?.scrollIntoView({ block: "center", behavior: "instant" });
    }, 50);
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) ||
          dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const applyDate = (year: number, month: number, day: number) => {
    const d = `${year}-${pad(month + 1)}-${pad(day)}`;
    onChange(dateOnly ? d : `${d}T${pad(sh)}:${pad(smin)}`);
  };
  const applyHour = (h: number) => { if (datePart) onChange(`${datePart}T${pad(h)}:${pad(smin)}`); };
  const applyMin  = (m: number) => { if (datePart) onChange(`${datePart}T${pad(sh)}:${pad(m)}`); };
  const goToToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    applyDate(t.getFullYear(), t.getMonth(), t.getDate());
    setOpen(false);
  };
  const clearDate = () => onChange(dateOnly ? "" : `T${pad(sh)}:${pad(smin)}`);

  const firstDay   = new Date(viewYear, viewMonth, 1);
  const lastDayN   = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startPad   = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + lastDayN) / 7) * 7;
  const today      = new Date();

  const displayDate = datePart
    ? new Date(datePart + "T00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: dateOnly ? "numeric" : undefined })
    : "—";
  const displayTime = `${pad(sh)}:${pad(smin)}`;

  const isWeekend = (dayIdx: number) => dayIdx === 5 || dayIdx === 6;

  return (
    <div className="flex-1">
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>{label}</label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full rounded-xl px-3 py-2.5 text-left transition-all"
        style={{
          border: open ? "1.5px solid var(--primary)" : "1.5px solid var(--input-border)",
          background: open ? (isDark ? "rgba(168,85,247,0.08)" : "#faf9ff") : "var(--input-bg)",
          boxShadow: open ? "0 0 0 3px rgba(124,58,237,0.12)" : "none",
        }}>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            {dateOnly ? (
              <div className="text-sm font-bold leading-tight" style={{ color: open ? "var(--primary)" : "var(--text)" }}>{displayDate}</div>
            ) : (
              <>
                <div className="text-xs font-semibold leading-tight" style={{ color: "var(--text-sec)" }}>{displayDate}</div>
                <div className="text-base font-black leading-tight" style={{ color: open ? "var(--primary)" : "var(--text)" }}>{displayTime}</div>
              </>
            )}
          </div>
          <svg className="w-4 h-4 shrink-0" style={{ color: open ? "var(--primary)" : "var(--text-muted)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.96 }}
              transition={{ duration: 0.15, type: "spring", stiffness: 400, damping: 28 }}
              style={{
                position: "fixed",
                top: pos.above ? "auto" : pos.top,
                bottom: pos.above ? window.innerHeight - pos.top : "auto",
                left: pos.left,
                zIndex: 9999,
                borderRadius: 16,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                background: isDark ? "#1a1625" : "#ffffff",
                border: isDark ? "1px solid rgba(139,92,246,0.25)" : "1px solid #e5e7eb",
                boxShadow: isDark
                  ? "0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(139,92,246,0.1), 0 0 48px rgba(124,58,237,0.12)"
                  : "0 16px 48px rgba(0,0,0,0.16), 0 0 0 1px rgba(124,58,237,0.06)",
              }}>
              <div style={{ height: 2, background: "linear-gradient(90deg,#7c3aed,#06b6d4,#a855f7)", flexShrink: 0 }} />

              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div className="p-3" style={{ borderRight: isDark ? "1px solid rgba(139,92,246,0.15)" : "1px solid #f0f0f0" }}>
                  <div className="flex items-center justify-between mb-3 gap-1">
                    <button type="button"
                      onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                      style={{ color: "var(--text-muted)", background: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5" }}>
                      ‹
                    </button>
                    <div className="text-center flex-1">
                      <div className="text-xs font-black tracking-wide" style={{ color: "var(--text)" }}>{MONTHS_NOM[viewMonth]}</div>
                      <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{viewYear}</div>
                    </div>
                    <button type="button"
                      onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                      style={{ color: "var(--text-muted)", background: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5" }}>
                      ›
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 30px)", marginBottom: 4 }}>
                    {DAYS.map((d, i) => (
                      <div key={d} style={{
                        textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.03em",
                        color: isWeekend(i) ? (isDark ? "rgba(168,85,247,0.7)" : "#a855f7") : "var(--text-muted)",
                        paddingBottom: 2,
                      }}>{d}</div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 30px)", gap: "2px 0" }}>
                    {Array.from({ length: totalCells }, (_, i) => {
                      const day     = i - startPad + 1;
                      const colIdx  = i % 7;
                      if (day < 1 || day > lastDayN) return <div key={i} style={{ width: 30, height: 30 }} />;
                      const isSelected = day === sd && viewMonth === (sm - 1) && viewYear === sy;
                      const isToday    = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
                      const wknd       = isWeekend(colIdx);
                      return (
                        <button key={i} type="button" onClick={() => applyDate(viewYear, viewMonth, day)}
                          style={{
                            width: 30, height: 30, borderRadius: "50%",
                            fontSize: 12, fontWeight: isSelected ? 800 : isToday ? 700 : 400,
                            background: isSelected
                              ? "linear-gradient(135deg,#7c3aed,#a855f7)"
                              : isToday ? (isDark ? "rgba(124,58,237,0.2)" : "#f0ebff") : "transparent",
                            color: isSelected ? "#fff" : isToday ? "var(--primary)" : wknd ? (isDark ? "rgba(168,85,247,0.7)" : "#a855f7") : "var(--text)",
                            cursor: "pointer", border: "none", transition: "all 0.1s",
                            boxShadow: isSelected ? "0 2px 10px rgba(124,58,237,0.5)" : "none",
                          }}>
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2.5"
                    style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #f0f0f0" }}>
                    <button type="button" onClick={clearDate}
                      className="text-xs font-semibold transition-all"
                      style={{ color: isDark ? "rgba(239,68,68,0.7)" : "#dc2626" }}>
                      Удалить
                    </button>
                    <button type="button" onClick={goToToday}
                      className="text-xs font-semibold transition-all"
                      style={{ color: "var(--primary)" }}>
                      Сегодня
                    </button>
                  </div>
                </div>

                {!dateOnly && <div style={{ display: "flex", flexDirection: "column" }}>
                  <div className="px-3 pt-3 pb-2 text-center">
                    <div className="text-lg font-black tracking-tight" style={{
                      background: "linear-gradient(90deg,#7c3aed,#06b6d4)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>
                      {pad(sh)}:{pad(smin)}
                    </div>
                  </div>

                  <div style={{ display: "flex", flex: 1 }}>
                    <div ref={hourColRef}
                      style={{ width: 50, maxHeight: 210, overflowY: "auto", padding: "4px 0" }}>
                      {HOUR_OPTIONS.map(h => (
                        <button key={h} type="button" data-sel={h === sh ? "true" : undefined}
                          onClick={() => applyHour(h)}
                          style={{
                            display: "block", width: "calc(100% - 8px)", margin: "1px 4px",
                            padding: "6px 0", fontSize: 12, fontWeight: h === sh ? 800 : 400,
                            background: h === sh ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "transparent",
                            color: h === sh ? "#fff" : "var(--text)",
                            borderRadius: 8, cursor: "pointer", border: "none", textAlign: "center",
                            transition: "all 0.1s",
                            boxShadow: h === sh ? "0 2px 8px rgba(124,58,237,0.4)" : "none",
                          }}>
                          {pad(h)}
                        </button>
                      ))}
                    </div>

                    <div style={{ width: 1, background: isDark ? "rgba(255,255,255,0.06)" : "#f0f0f0", margin: "8px 0" }} />

                    <div ref={minColRef}
                      style={{ width: 50, maxHeight: 210, overflowY: "auto", padding: "4px 0" }}>
                      {MIN_OPTIONS.map(m => (
                        <button key={m} type="button" data-msel={m === smin ? "true" : undefined}
                          onClick={() => applyMin(m)}
                          style={{
                            display: "block", width: "calc(100% - 8px)", margin: "1px 4px",
                            padding: "6px 0", fontSize: 12, fontWeight: m === smin ? 800 : 400,
                            background: m === smin ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "transparent",
                            color: m === smin ? "#fff" : "var(--text)",
                            borderRadius: 8, cursor: "pointer", border: "none", textAlign: "center",
                            transition: "all 0.1s",
                            boxShadow: m === smin ? "0 2px 8px rgba(124,58,237,0.4)" : "none",
                          }}>
                          :{pad(m)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>}
              </div>

              <div className="px-3 py-2 flex items-center justify-between gap-3"
                style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #f0f0f0" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  {datePart
                    ? new Date(datePart + "T00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })
                    : ""}
                </span>
                <motion.button
                  type="button"
                  onClick={() => setOpen(false)}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  style={{
                    background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                    color: "#fff", border: "none", borderRadius: 8,
                    padding: "5px 14px", fontSize: 12, fontWeight: 800,
                    cursor: "pointer", boxShadow: "0 2px 10px rgba(124,58,237,0.45)",
                    letterSpacing: "0.02em",
                  }}>
                  OK ✓
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
