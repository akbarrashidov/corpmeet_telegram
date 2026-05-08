import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@corpmeet/design/theme";
import { useTranslation, type TranslationKey } from "../i18n";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const HOUR_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 7);
const MIN_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

const MONTH_KEYS: TranslationKey[] = [
  "month.january", "month.february", "month.march", "month.april",
  "month.may", "month.june", "month.july", "month.august",
  "month.september", "month.october", "month.november", "month.december",
];
const MONTH_GEN_KEYS: TranslationKey[] = [
  "month.gen.january", "month.gen.february", "month.gen.march", "month.gen.april",
  "month.gen.may", "month.gen.june", "month.gen.july", "month.gen.august",
  "month.gen.september", "month.gen.october", "month.gen.november", "month.gen.december",
];
// Order: Mon..Sun (matches calendar grid display)
const DOW_SHORT_KEYS: TranslationKey[] = [
  "dow.short.mon", "dow.short.tue", "dow.short.wed", "dow.short.thu",
  "dow.short.fri", "dow.short.sat", "dow.short.sun",
];
// JS Date.getDay(): 0=Sun..6=Sat — these keys mirror that order
const DOW_LONG_KEYS_JS: TranslationKey[] = [
  "dow.long.sun", "dow.long.mon", "dow.long.tue", "dow.long.wed",
  "dow.long.thu", "dow.long.fri", "dow.long.sat",
];

export interface DateTimePickerProps {
  label: string;
  /** "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD" when dateOnly */
  value: string;
  onChange: (v: string) => void;
  dateOnly?: boolean;
}

export function DateTimePicker({ label, value, onChange, dateOnly }: DateTimePickerProps) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minColRef = useRef<HTMLDivElement>(null);

  const [datePart, rawTime] = value
    ? dateOnly
      ? [value, "00:00"]
      : value.split("T")
    : ["", "09:00"];
  const timePart = rawTime || "09:00";
  const [sy, sm, sd] = datePart ? datePart.split("-").map(Number) : [0, 0, 0];
  const [sh, smin] = timePart.split(":").map(Number);

  const [viewYear, setViewYear] = useState(() => sy || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (sm ? sm - 1 : new Date().getMonth()));

  useEffect(() => {
    if (sy) setViewYear(sy);
    if (sm) setViewMonth(sm - 1);
  }, [sy, sm]);

  // Centered modal-style popup — фиксированная позиция вне зависимости от trigger'а.
  const [pos, setPos] = useState({ width: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const margin = 8;
    const maxWidth = 360;
    const screenW = window.innerWidth;
    setPos({ width: Math.min(maxWidth, screenW - margin * 2) });
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
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const applyDate = (year: number, month: number, day: number) => {
    const d = `${year}-${pad(month + 1)}-${pad(day)}`;
    onChange(dateOnly ? d : `${d}T${pad(sh)}:${pad(smin)}`);
  };
  const applyHour = (h: number) => {
    if (datePart) onChange(`${datePart}T${pad(h)}:${pad(smin)}`);
  };
  const applyMin = (m: number) => {
    if (datePart) onChange(`${datePart}T${pad(sh)}:${pad(m)}`);
  };
  const goToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    applyDate(now.getFullYear(), now.getMonth(), now.getDate());
    setOpen(false);
  };
  const clearDate = () => onChange(dateOnly ? "" : `T${pad(sh)}:${pad(smin)}`);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDayN = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + lastDayN) / 7) * 7;
  const today = new Date();

  const displayDate = useMemo(() => {
    if (!datePart) return "—";
    const d = new Date(datePart + "T00:00");
    const day = d.getDate();
    const month = t(MONTH_GEN_KEYS[d.getMonth()]);
    return `${pad(day)} ${month}`;
  }, [datePart, t]);
  const displayTime = `${pad(sh)}:${pad(smin)}`;

  const footerLabel = useMemo(() => {
    if (!datePart) return "";
    const d = new Date(datePart + "T00:00");
    const dow = t(DOW_LONG_KEYS_JS[d.getDay()]);
    const month = t(MONTH_GEN_KEYS[d.getMonth()]);
    return `${dow}, ${d.getDate()} ${month}`;
  }, [datePart, t]);

  const isWeekend = (dayIdx: number) => dayIdx === 5 || dayIdx === 6;

  return (
    <div className="flex-1">
      <label
        className="block text-xs font-semibold mb-1.5"
        style={{ color: "var(--text-sec)" }}
      >
        {label}
      </label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl px-3 py-2.5 transition-all"
        style={{
          border: open ? "1.5px solid var(--primary)" : "1.5px solid var(--input-border)",
          background: open ? (isDark ? "rgba(168,85,247,0.08)" : "#faf9ff") : "var(--input-bg)",
          boxShadow: open ? "0 0 0 3px rgba(124,58,237,0.12)" : "none",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 text-center">
            {dateOnly ? (
              <div
                className="text-sm font-bold leading-tight"
                style={{ color: open ? "var(--primary)" : "var(--text)" }}
              >
                {displayDate}
              </div>
            ) : (
              <>
                <div
                  className="text-xs font-semibold leading-tight"
                  style={{ color: "var(--text-sec)" }}
                >
                  {displayDate}
                </div>
                <div
                  className="text-base font-black leading-tight"
                  style={{ color: open ? "var(--primary)" : "var(--text)" }}
                >
                  {displayTime}
                </div>
              </>
            )}
          </div>
          <svg
            width={16}
            height={16}
            style={{ flexShrink: 0, color: open ? "var(--primary)" : "var(--text-muted)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                pointerEvents: "none",
              }}
            >
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15, type: "spring", stiffness: 400, damping: 28 }}
                style={{
                  pointerEvents: "auto",
                  width: pos.width,
                  maxHeight: "calc(100vh - 32px)",
                  overflowY: "auto",
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  background: isDark ? "#1a1625" : "#ffffff",
                  border: isDark ? "1px solid rgba(139,92,246,0.25)" : "1px solid #e5e7eb",
                  boxShadow: isDark
                    ? "0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(139,92,246,0.1), 0 0 48px rgba(124,58,237,0.12)"
                    : "0 16px 48px rgba(0,0,0,0.16), 0 0 0 1px rgba(124,58,237,0.06)",
                }}
              >
              <div
                style={{
                  height: 2,
                  background: "linear-gradient(90deg,#7c3aed,#06b6d4,#a855f7)",
                  flexShrink: 0,
                }}
              />

              <div style={{ display: "flex", alignItems: "stretch" }}>
                {/* Calendar */}
                <div
                  style={{
                    padding: 12,
                    flex: 1,
                    minWidth: 0,
                    borderRight: isDark
                      ? "1px solid rgba(139,92,246,0.15)"
                      : "1px solid #f0f0f0",
                  }}
                >
                  <div className="flex items-center justify-between mb-3 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (viewMonth === 0) {
                          setViewMonth(11);
                          setViewYear((y) => y - 1);
                        } else setViewMonth((m) => m - 1);
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 8,
                        color: "var(--text-muted)",
                        background: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      ‹
                    </button>
                    <div className="text-center flex-1">
                      <div
                        className="text-xs font-black tracking-wide"
                        style={{ color: "var(--text)" }}
                      >
                        {t(MONTH_KEYS[viewMonth])}
                      </div>
                      <div
                        className="text-xs font-semibold"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {viewYear}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (viewMonth === 11) {
                          setViewMonth(0);
                          setViewYear((y) => y + 1);
                        } else setViewMonth((m) => m + 1);
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 8,
                        color: "var(--text-muted)",
                        background: isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      ›
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      marginBottom: 4,
                    }}
                  >
                    {DOW_SHORT_KEYS.map((key, i) => (
                      <div
                        key={key}
                        style={{
                          textAlign: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.03em",
                          color: isWeekend(i)
                            ? isDark
                              ? "rgba(168,85,247,0.7)"
                              : "#a855f7"
                            : "var(--text-muted)",
                          paddingBottom: 2,
                        }}
                      >
                        {t(key)}
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: "2px 0",
                    }}
                  >
                    {Array.from({ length: totalCells }, (_, i) => {
                      const day = i - startPad + 1;
                      const colIdx = i % 7;
                      if (day < 1 || day > lastDayN)
                        return <div key={i} style={{ aspectRatio: "1 / 1" }} />;
                      const isSelected =
                        day === sd && viewMonth === sm - 1 && viewYear === sy;
                      const isToday =
                        today.getDate() === day &&
                        today.getMonth() === viewMonth &&
                        today.getFullYear() === viewYear;
                      const wknd = isWeekend(colIdx);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => applyDate(viewYear, viewMonth, day)}
                          style={{
                            aspectRatio: "1 / 1",
                            margin: "0 auto",
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            fontSize: 12,
                            fontWeight: isSelected ? 800 : isToday ? 700 : 400,
                            background: isSelected
                              ? "linear-gradient(135deg,#7c3aed,#a855f7)"
                              : isToday
                                ? isDark
                                  ? "rgba(124,58,237,0.2)"
                                  : "#f0ebff"
                                : "transparent",
                            color: isSelected
                              ? "#fff"
                              : isToday
                                ? "var(--primary)"
                                : wknd
                                  ? isDark
                                    ? "rgba(168,85,247,0.7)"
                                    : "#a855f7"
                                  : "var(--text)",
                            cursor: "pointer",
                            border: "none",
                            transition: "all 0.1s",
                            boxShadow: isSelected
                              ? "0 2px 10px rgba(124,58,237,0.5)"
                              : "none",
                          }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: isDark
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid #f0f0f0",
                    }}
                  >
                    <button
                      type="button"
                      onClick={clearDate}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isDark ? "rgba(239,68,68,0.7)" : "#dc2626",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {t("picker.clear")}
                    </button>
                    <button
                      type="button"
                      onClick={goToToday}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--primary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {t("picker.today")}
                    </button>
                  </div>
                </div>

                {/* Time */}
                {!dateOnly && (
                  <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
                    <div style={{ padding: "12px 12px 8px", textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 900,
                          letterSpacing: "-0.02em",
                          background: "linear-gradient(90deg,#7c3aed,#06b6d4)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        {pad(sh)}:{pad(smin)}
                      </div>
                    </div>

                    <div style={{ display: "flex", flex: 1 }}>
                      <div
                        ref={hourColRef}
                        style={{ width: 50, maxHeight: 210, overflowY: "auto", padding: "4px 0" }}
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <button
                            key={h}
                            type="button"
                            data-sel={h === sh ? "true" : undefined}
                            onClick={() => applyHour(h)}
                            style={{
                              display: "block",
                              width: "calc(100% - 8px)",
                              margin: "1px 4px",
                              padding: "6px 0",
                              fontSize: 12,
                              fontWeight: h === sh ? 800 : 400,
                              background:
                                h === sh
                                  ? "linear-gradient(135deg,#7c3aed,#a855f7)"
                                  : "transparent",
                              color: h === sh ? "#fff" : "var(--text)",
                              borderRadius: 8,
                              cursor: "pointer",
                              border: "none",
                              textAlign: "center",
                              transition: "all 0.1s",
                              boxShadow:
                                h === sh ? "0 2px 8px rgba(124,58,237,0.4)" : "none",
                            }}
                          >
                            {pad(h)}
                          </button>
                        ))}
                      </div>

                      <div
                        style={{
                          width: 1,
                          background: isDark ? "rgba(255,255,255,0.06)" : "#f0f0f0",
                          margin: "8px 0",
                        }}
                      />

                      <div
                        ref={minColRef}
                        style={{ width: 50, maxHeight: 210, overflowY: "auto", padding: "4px 0" }}
                      >
                        {MIN_OPTIONS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            data-msel={m === smin ? "true" : undefined}
                            onClick={() => applyMin(m)}
                            style={{
                              display: "block",
                              width: "calc(100% - 8px)",
                              margin: "1px 4px",
                              padding: "6px 0",
                              fontSize: 12,
                              fontWeight: m === smin ? 800 : 400,
                              background:
                                m === smin
                                  ? "linear-gradient(135deg,#7c3aed,#a855f7)"
                                  : "transparent",
                              color: m === smin ? "#fff" : "var(--text)",
                              borderRadius: 8,
                              cursor: "pointer",
                              border: "none",
                              textAlign: "center",
                              transition: "all 0.1s",
                              boxShadow:
                                m === smin ? "0 2px 8px rgba(124,58,237,0.4)" : "none",
                            }}
                          >
                            :{pad(m)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  borderTop: isDark
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "1px solid #f0f0f0",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {footerLabel}
                </span>
                <motion.button
                  type="button"
                  onClick={() => setOpen(false)}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  style={{
                    background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(124,58,237,0.45)",
                    letterSpacing: "0.02em",
                    flexShrink: 0,
                  }}
                >
                  {t("picker.ok")} ✓
                </motion.button>
              </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
