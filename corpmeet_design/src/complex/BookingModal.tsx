import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DateTimePicker } from "../components/DateTimePicker";
import { useTheme } from "../theme/ThemeContext";


import { useBookings, useCreateBooking, useDeleteBooking, useUpdateBooking, useUsers } from "./hooks/useBookings";
import type { Booking } from "./types";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStart?: Date;
  initialEnd?: Date;
  editBooking?: Booking | null;
  canEdit?: boolean;
  canDelete?: boolean;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function toLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}


const PRESETS = [
  { label: "30м", minutes: 30 },
  { label: "1ч",  minutes: 60 },
  { label: "1.5ч",minutes: 90 },
  { label: "2ч",  minutes: 120 },
];

const RECURRENCE_OPTIONS = [
  { value: "none",   label: "Нет" },
  { value: "daily",  label: "Каждый день" },
  { value: "weekly", label: "Каждую неделю" },
  { value: "custom", label: "Своё расписание" },
] as const;

const WEEKDAYS = [
  { idx: 0, short: "Пн" },
  { idx: 1, short: "Вт" },
  { idx: 2, short: "Ср" },
  { idx: 3, short: "Чт" },
  { idx: 4, short: "Пт" },
  { idx: 5, short: "Сб" },
  { idx: 6, short: "Вс" },
];

/* ── Guest autocomplete input ── */
function GuestInput({
  guests, setGuests,
}: { guests: string[]; setGuests: React.Dispatch<React.SetStateAction<string[]>> }) {
  const { isDark } = useTheme();
  const { data: allUsers = [] } = useUsers();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  const suggestions = allUsers.filter(u =>
    u.username &&
    !guests.includes(u.username) &&
    (input.length === 0 ||
     u.username.toLowerCase().includes(input.toLowerCase()) ||
     u.display_name.toLowerCase().includes(input.toLowerCase()))
  ).slice(0, 6);

  const addGuest = (username: string) => {
    const u = username.trim().toLowerCase().replace(/^@/, "");
    if (u && !guests.includes(u)) setGuests(gs => [...gs, u]);
    setInput("");
    setFocused(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const commitInput = () => {
    const u = input.trim().toLowerCase().replace(/^@/, "");
    if (u && !guests.includes(u)) setGuests(gs => [...gs, u]);
    setInput("");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const showDrop = focused && suggestions.length > 0;

  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>
        Гости
      </label>
      <div ref={wrapRef} className="relative">
        <div
          className="rounded-xl px-3 py-2 flex flex-wrap gap-1.5 min-h-[40px] transition-all cursor-text"
          style={{
            background: "var(--input-bg)",
            border: focused ? "1.5px solid var(--primary)" : "1.5px solid var(--input-border)",
            boxShadow: focused ? "0 0 0 3px rgba(124,58,237,0.12)" : "none",
          }}
          onClick={() => inputRef.current?.focus()}
        >
          {guests.map(g => (
            <motion.span key={g} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
              style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)", color: "var(--primary)" }}>
              @{g}
              <button type="button" onClick={() => setGuests(gs => gs.filter(x => x !== g))}
                className="opacity-60 hover:opacity-100 leading-none" style={{ fontSize: 14 }}>×</button>
            </motion.span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.replace(/\s/g, ""))}
            onFocus={() => setFocused(true)}
            onKeyDown={e => {
              if ((e.key === "Enter" || e.key === ",") && input.trim()) { e.preventDefault(); commitInput(); }
              else if (e.key === "Backspace" && !input && guests.length > 0) setGuests(gs => gs.slice(0, -1));
            }}
            onBlur={() => { setTimeout(() => { if (input.trim()) commitInput(); }, 150); }}
            placeholder={guests.length === 0 ? "Имя или @username" : ""}
            className="flex-1 min-w-[100px] text-xs outline-none bg-transparent"
            style={{ color: "var(--text)" }}
          />
        </div>

        {/* Suggestions dropdown */}
        <AnimatePresence>
          {showDrop && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-hidden"
              style={{
                background: "var(--modal)", border: "1px solid var(--border)",
                boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.6)" : "0 4px 16px rgba(0,0,0,0.12)",
              }}>
              {suggestions.map(u => (
                <button key={u.id} type="button"
                  onMouseDown={e => { e.preventDefault(); addGuest(u.username!); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs transition-all"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--elevated)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    {u.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{u.display_name}</div>
                    {u.username && <div style={{ color: "var(--text-muted)" }}>@{u.username}</div>}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

type View = "form" | "confirmDelete";

interface ConstellationNode {
  x: number; y: number;
  vx: number; vy: number;
  phase: number;
  size: number;
  hue: number;
  shape: 0|1|2|3; // 0=circle 1=diamond 2=cross 3=triangle
}

export function BookingModal({
  isOpen, onClose, initialStart, initialEnd,
  editBooking, canEdit, canDelete,
  onSuccess, onError
}: BookingModalProps) {
  const { isDark } = useTheme();
  const isEdit     = !!editBooking;
  const isReadOnly = isEdit && !canEdit;
  const now   = new Date();
  const later = new Date(now.getTime() + 3_600_000);

  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const cardRef      = useRef<HTMLDivElement | null>(null);
  const nodesRef     = useRef<ConstellationNode[]>([]);
  const rafRef       = useRef<number>(0);
  const typePulseRef = useRef<number>(0);
  const dragControls = useDragControls();

  /* ── Constellation animation ── */
  useEffect(() => {
    if (!isOpen) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:45";
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const W0 = window.innerWidth, H0 = window.innerHeight;
    const N_NODES   = 180;
    const MAX_CONN  = 200;
    const HL_RADIUS = 380;

    nodesRef.current = Array.from({ length: N_NODES }, () => {
      const dir = Math.random() * Math.PI * 2;
      const spd = 0.10 + Math.random() * 0.20;
      return {
        x:     Math.random() * W0,
        y:     Math.random() * H0,
        vx:    Math.cos(dir) * spd,
        vy:    Math.sin(dir) * spd,
        phase: Math.random() * Math.PI * 2,
        size:  1.4 + Math.random() * 2.0,
        hue:   Math.random() * 360,
        shape: Math.floor(Math.random() * 4) as 0|1|2|3,
      };
    });

    const onType = () => { typePulseRef.current = 1.0; };
    document.addEventListener("keydown", onType);

    const ctx = canvas.getContext("2d")!;
    let t = 0;

    const loop = () => {
      t += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height;

      const el   = cardRef.current;
      const rect = el?.getBoundingClientRect();
      const cx   = rect ? rect.left + rect.width  / 2 : W0 / 2;
      const cy   = rect ? rect.top  + rect.height / 2 : H0 / 2;

      typePulseRef.current *= 0.88;
      const pulse = typePulseRef.current;

      const dark = document.documentElement.getAttribute("data-theme") !== "light";

      const nodes = nodesRef.current;

      /* move nodes — gentle wander, wrap edges */
      for (const n of nodes) {
        n.vx += Math.sin(t * 0.4 + n.phase)        * 0.003;
        n.vy += Math.cos(t * 0.35 + n.phase * 1.2) * 0.003;
        // soft speed limit
        const spd = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (spd > 0.38) { n.vx *= 0.38 / spd; n.vy *= 0.38 / spd; }
        n.x += n.vx; n.y += n.vy;
        // wrap
        if (n.x < -20) n.x = W + 20;
        if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        if (n.y > H + 20) n.y = -20;
      }

      /* ── draw connection lines ── */
      ctx.lineCap = "round";
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 > MAX_CONN * MAX_CONN) continue;
          const dist = Math.sqrt(dist2);

          // base alpha: fades with distance
          const baseA = (1 - dist / MAX_CONN) * (dark ? 0.32 : 0.52);

          // highlight: how close is card center to the midpoint of this line?
          const mx = (a.x + b.x) * 0.5, my = (a.y + b.y) * 0.5;
          const cdx = mx - cx, cdy = my - cy;
          const cardDist = Math.sqrt(cdx * cdx + cdy * cdy);
          const hl = Math.max(0, 1 - cardDist / HL_RADIUS);
          const hlPulse = Math.max(0, 1 - Math.sqrt((mx-cx)**2+(my-cy)**2) / (HL_RADIUS * 1.5)) * pulse;

          const alpha = baseA + hl * (dark ? 0.70 : 0.65) + hlPulse * 0.45;
          if (alpha < 0.005) continue;

          const hue = dark ? 220 + hl * 50 : 220;
          const sat = dark ? 60 + hl * 30  : 8 + hl * 10;
          const lit = dark ? 65 + hl * 25  : 12 + hl * 10;

          ctx.globalAlpha = alpha;
          ctx.lineWidth   = 0.8 + hl * 1.4;
          ctx.strokeStyle = `hsl(${hue},${sat}%,${lit}%)`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      /* ── draw nodes ── */
      for (const n of nodes) {
        const ndx = n.x - cx, ndy = n.y - cy;
        const cardDist = Math.sqrt(ndx * ndx + ndy * ndy);
        const hl = Math.max(0, 1 - cardDist / HL_RADIUS);
        const hlPulse = Math.max(0, 1 - cardDist / (HL_RADIUS * 1.5)) * pulse;

        const baseA = dark ? 0.38 : 0.55;
        const alpha = baseA + hl * (dark ? 0.72 : 0.68) + hlPulse * 0.45;
        const r     = n.size * (1 + hl * 1.4 + hlPulse * 0.8);
        const hue   = dark ? 220 + hl * 60 : 220;
        const sat   = dark ? 50 + hl * 40  : 8 + hl * 10;
        const lit   = dark ? 70 + hl * 22  : 10 + hl * 10;

        // glow for highlighted nodes
        if (hl > 0.05) {
          ctx.globalAlpha = (hl + hlPulse) * (dark ? 0.35 : 0.38);
          ctx.fillStyle   = `hsl(${hue},${sat}%,${lit + 15}%)`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle   = `hsl(${hue},${sat}%,${lit}%)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      document.removeEventListener("keydown", onType);
      canvas.remove();
    };
  }, [isOpen]);

  const [view,        setView]      = useState<View>("form");
  const [title,       setTitle]     = useState("");
  const [description, setDesc]      = useState("");
  const [startTime,   setStart]     = useState(toLocal(now));
  const [endTime,     setEnd]       = useState(toLocal(later));
  const [guests,      setGuests]    = useState<string[]>([]);
  const [recurrence,  setRecur]     = useState<"none" | "daily" | "weekly" | "custom">("none");
  const [recurUntil,  setRecurUntil]= useState("");
  const [recurDays,   setRecurDays] = useState<number[]>([]);
  const [deleteSeries,setDelSeries] = useState(false);
  const [error,       setError]     = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; time?: string; days?: string }>({});

  // Conflict preview: load bookings for the selected date
  const dateStr = startTime ? startTime.split("T")[0] : undefined;
  const { data: dayBookings = [] } = useBookings(dateStr);
  const conflicts = !isEdit
    ? dayBookings.filter((b) => {
        const bStart = new Date(b.start_time).getTime();
        const bEnd   = new Date(b.end_time).getTime();
        const sStart = new Date(startTime).getTime();
        const sEnd   = new Date(endTime).getTime();
        return bStart < sEnd && bEnd > sStart;
      })
    : [];

  const { mutateAsync: createBooking, isPending: isCreating } = useCreateBooking();
  const { mutateAsync: updateBooking, isPending: isUpdating } = useUpdateBooking();
  const { mutateAsync: deleteBooking, isPending: isDeleting } = useDeleteBooking();

  useEffect(() => {
    if (!isOpen) return;
    setView("form"); setError(null); setDelSeries(false);
    if (editBooking) {
      setTitle(editBooking.title);
      setDesc(editBooking.description ?? "");
      setStart(toLocal(new Date(editBooking.start_time)));
      setEnd(toLocal(new Date(editBooking.end_time)));
      setGuests(editBooking.guests ?? []);
      setRecur(editBooking.recurrence ?? "none");
      setRecurUntil(editBooking.recurrence_until ?? "");
    } else {
      setTitle(""); setDesc(""); setGuests([]);
      setRecur("none"); setRecurUntil(""); setRecurDays([]);
      setStart(toLocal(initialStart ?? now));
      setEnd(toLocal(initialEnd ?? later));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editBooking?.id]);

  const currentDurationMins = startTime && endTime
    ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000)
    : 0;

  const applyPreset = (mins: number) =>
    setEnd(toLocal(new Date(new Date(startTime).getTime() + mins * 60_000)));

  const validateFields = (): boolean => {
    const errs: { title?: string; time?: string; days?: string } = {};
    if (!title.trim()) errs.title = "Название обязательно";
    const sMs = new Date(startTime).getTime();
    const eMs = new Date(endTime).getTime();
    const durMin = (eMs - sMs) / 60_000;
    if (sMs >= eMs) errs.time = "Конец должен быть позже начала";
    else if (durMin < 15) errs.time = "Минимум 15 минут";
    else if (durMin > 480) errs.time = "Максимум 8 часов";
    if (recurrence === "custom" && recurDays.length === 0) errs.days = "Выберите хотя бы один день";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!validateFields()) return;
    const startISO = new Date(startTime).toISOString();
    const endISO   = new Date(endTime).toISOString();
    try {
      if (isEdit && editBooking) {
        await updateBooking({ id: editBooking.id, payload: { title, description, start_time: startISO, end_time: endISO, guests } });
        onSuccess?.("✅ Встреча обновлена");
      } else {
        const created = await createBooking({
          title, description, start_time: startISO, end_time: endISO, guests,
          recurrence,
          recurrence_until: recurrence !== "none" && recurUntil ? recurUntil : undefined,
          recurrence_days: recurrence === "custom" ? recurDays : undefined,
        });
        const count = created.length;
        onSuccess?.(count > 1 ? `✅ Создано ${count} встреч` : "✅ Встреча забронирована");
      }
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      onError?.(msg ?? "Ошибка сохранения");
      setError(msg ?? "Ошибка сохранения");
    }
  };

  const handleDelete = async () => {
    if (!editBooking) return;
    try {
      await deleteBooking({ id: editBooking.id, deleteSeries });
      onSuccess?.(deleteSeries ? "🗑 Серия встреч удалена" : "🗑 Бронирование удалено");
      onClose();
    } catch {
      onError?.("Ошибка при удалении");
      setError("Ошибка при удалении");
      setView("form");
    }
  };

  const tgUser  = editBooking?.user;
  const tgLink  = tgUser?.username ? `https://t.me/${tgUser.username}` : `tg://user?id=${tgUser?.telegram_id}`;
  const tgLabel = tgUser?.username ? `@${tgUser.username}` : `ID ${tgUser?.telegram_id}`;

  const errBg     = isDark ? "rgba(239,68,68,0.1)"  : "#fff1f2";
  const errBorder = isDark ? "rgba(239,68,68,0.3)"  : "#fecdd3";
  const errColor  = isDark ? "#f87171"               : "#dc2626";
  const delBg     = isDark ? "rgba(239,68,68,0.08)" : "#fff1f2";
  const delBorder = isDark ? "rgba(239,68,68,0.35)" : "#fecdd3";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40" onClick={onClose}
            style={{ background: isDark ? "rgba(0,0,0,0.72)" : "rgba(15,23,42,0.55)" }} />

          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 pointer-events-none">
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ type: "spring", damping: 22, stiffness: 340 }}
              ref={cardRef}
              drag
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              dragElastic={0.06}
              whileDrag={{
                scale: 1.018,
              }}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl relative pointer-events-auto"
              style={{
                background: "var(--modal)",
                border: "1px solid var(--border)",
                boxShadow: isDark
                  ? "0 32px 80px rgba(0,0,0,0.8)"
                  : "0 8px 16px rgba(0,0,0,0.10), 0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
                maxHeight: "90vh",
                overflowY: "auto",
                cursor: "default",
              }}>

              {/* Header — drag handle (only this area initiates drag) */}
              <div className="flex items-center justify-between px-6 pt-4 pb-3"
                style={{ borderBottom: "1px solid var(--border)", cursor: "grab", touchAction: "none" }}
                onPointerDown={(e) => dragControls.start(e)}>
                <div>
                  <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
                    {view === "confirmDelete" ? "Удалить бронирование?" :
                     isReadOnly ? "Информация о встрече" :
                     isEdit ? "Редактировать встречу" : "Новое бронирование"}
                  </h2>
                  {isEdit && tgUser && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#06b6d4" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Организатор: </span>
                      <a href={tgLink} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold hover:underline" style={{ color: "#0891b2" }}>
                        {tgLabel}
                      </a>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-xl leading-none transition-all"
                    style={{ color: "var(--text-muted)", background: "var(--elevated)" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>
                    ×
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">

                {/* ── Read-only view ── */}
                {isReadOnly && editBooking ? (
                  <motion.div key="readonly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="px-6 py-5 space-y-3">
                    <div className="rounded-xl p-4 space-y-2"
                      style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                      <p className="font-bold text-base" style={{ color: "var(--text)" }}>{editBooking.title}</p>
                      <p className="text-sm" style={{ color: "var(--text-sec)" }}>
                        {fmtTime(editBooking.start_time)} — {new Date(editBooking.end_time).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}
                      </p>
                      {editBooking.description && (
                        <p className="text-xs" style={{ color: "var(--text-sec)" }}>{editBooking.description}</p>
                      )}
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Автор: {tgUser?.display_name}</p>
                      {editBooking.guests?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {editBooking.guests.map(g => (
                            <span key={g} className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                              style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)", color: "var(--primary)" }}>
                              @{g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {tgUser && (
                      <a href={tgLink} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold justify-center"
                        style={{ background: isDark ? "rgba(6,182,212,0.1)" : "#ecfeff", border: isDark ? "1px solid rgba(6,182,212,0.3)" : "1px solid #a5f3fc", color: "#0891b2" }}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                        </svg>
                        Написать в Telegram
                      </a>
                    )}
                    <button onClick={onClose}
                      className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{ border: "1px solid var(--border)", color: "var(--text-sec)", background: "var(--elevated)" }}>
                      Закрыть
                    </button>
                  </motion.div>
                ) :

                /* ── Delete confirm ── */
                view === "confirmDelete" ? (
                  <motion.div key="del" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="px-6 py-5 space-y-3">
                    <div className="rounded-xl p-4" style={{ background: delBg, border: `1px solid ${delBorder}` }}>
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
                        Удалить <span className="font-bold">«{editBooking?.title}»</span>?
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Это действие необратимо. В Telegram придёт уведомление.
                      </p>
                    </div>

                    {/* Delete series option */}
                    {editBooking?.recurrence_group_id && (
                      <label className="flex items-center gap-2 px-1 cursor-pointer">
                        <input type="checkbox" checked={deleteSeries} onChange={e => setDelSeries(e.target.checked)}
                          className="rounded" style={{ accentColor: "var(--primary)" }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--text-sec)" }}>
                          Удалить все следующие встречи серии
                        </span>
                      </label>
                    )}

                    <div className="flex gap-3">
                      <button onClick={() => setView("form")}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{ border: "1px solid var(--border)", color: "var(--text-sec)", background: "var(--elevated)" }}>
                        Отмена
                      </button>
                      <button onClick={handleDelete} disabled={isDeleting}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 4px 14px rgba(220,38,38,0.3)" }}>
                        {isDeleting ? "Удаляем..." : "Удалить"}
                      </button>
                    </div>
                  </motion.div>
                ) : (

                /* ── Edit / Create form ── */
                <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onSubmit={handleSubmit} className="px-6 py-4 space-y-3">

                  {/* Title */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>
                      Название встречи <span style={{ color: "#ef4444", fontWeight: 400 }}>(*обязательно)</span>
                    </label>
                    <input type="text" autoFocus value={title}
                      onChange={e => { setTitle(e.target.value); if (fieldErrors.title) setFieldErrors(fe => ({ ...fe, title: undefined })); }}
                      placeholder="Планёрка, 1-on-1, Demo..."
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                      style={{
                        background: "var(--input-bg)",
                        border: `1.5px solid ${fieldErrors.title ? "#ef4444" : "var(--input-border)"}`,
                        color: "var(--text)",
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = fieldErrors.title ? "#ef4444" : "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = fieldErrors.title ? "#ef4444" : "var(--input-border)"; e.currentTarget.style.boxShadow = "none"; }} />
                    {fieldErrors.title && (
                      <p className="text-xs mt-1 font-medium" style={{ color: "#ef4444" }}>{fieldErrors.title}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>
                      Повестка / заметки <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(необязательно)</span>
                    </label>
                    <textarea value={description} onChange={e => setDesc(e.target.value)}
                      placeholder="Цель встречи, ссылки, материалы..."
                      rows={2}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all resize-none"
                      style={{ background: "var(--input-bg)", border: "1.5px solid var(--input-border)", color: "var(--text)" }}
                      onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "var(--input-border)"; e.currentTarget.style.boxShadow = "none"; }} />
                  </div>

                  {/* Guests */}
                  <GuestInput guests={guests} setGuests={setGuests} />

                  {/* Date/time */}
                  <div>
                    <div className="flex gap-3">
                      <DateTimePicker label="Начало" value={startTime}
                        onChange={v => { setStart(v); setFieldErrors(fe => ({ ...fe, time: undefined })); }} />
                      <DateTimePicker label="Конец"  value={endTime}
                        onChange={v => { setEnd(v); setFieldErrors(fe => ({ ...fe, time: undefined })); }} />
                    </div>
                    {fieldErrors.time && (
                      <p className="text-xs mt-1 font-medium" style={{ color: "#ef4444" }}>{fieldErrors.time}</p>
                    )}
                    {/* Conflict preview */}
                    {!isEdit && conflicts.length > 0 && !fieldErrors.time && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-2 rounded-xl px-3 py-2.5 space-y-1"
                        style={{ background: isDark ? "rgba(239,68,68,0.08)" : "#fff1f2", border: "1px solid rgba(239,68,68,0.25)" }}>
                        <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                          ⚠️ Пересечение с {conflicts.length} встреч{conflicts.length === 1 ? "ей" : "ами"}:
                        </p>
                        {conflicts.map(c => (
                          <p key={c.id} className="text-xs" style={{ color: isDark ? "#fca5a5" : "#dc2626" }}>
                            • {c.title} ({new Date(c.start_time).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}–{new Date(c.end_time).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})})
                          </p>
                        ))}
                      </motion.div>
                    )}
                  </div>

                  {/* Quick duration presets */}
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Быстрая длительность</p>
                    <div className="flex gap-2">
                      {PRESETS.map(p => {
                        const active = currentDurationMins === p.minutes;
                        return (
                          <motion.button key={p.label} type="button" onClick={() => applyPreset(p.minutes)}
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                            style={{
                              background: active ? "var(--primary)" : "var(--primary-light)",
                              border: `1.5px solid ${active ? "var(--primary)" : "var(--primary-border)"}`,
                              color: active ? "#fff" : "var(--primary)",
                            }}>
                            {p.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recurrence (only on create) */}
                  {!isEdit && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold" style={{ color: "var(--text-sec)" }}>Повторение</label>
                      <div className="flex gap-2">
                        {RECURRENCE_OPTIONS.map(opt => (
                          <button key={opt.value} type="button"
                            onClick={() => {
                              setRecur(opt.value);
                              // Автоматически задаём "Повторять до" если не задано
                              if (opt.value !== "none" && !recurUntil) {
                                const d = new Date(startTime || Date.now());
                                d.setMonth(d.getMonth() + (opt.value === "daily" ? 1 : 3));
                                setRecurUntil(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`);
                              }
                            }}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background: recurrence === opt.value ? "var(--primary)" : "var(--elevated)",
                              border: recurrence === opt.value ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                              color: recurrence === opt.value ? "#fff" : "var(--text-sec)",
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {recurrence === "custom" && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                          <label className="block text-xs font-semibold mb-1.5" style={{ color: fieldErrors.days ? "#ef4444" : "var(--text-sec)" }}>
                            Дни недели {fieldErrors.days && <span className="font-normal">— {fieldErrors.days}</span>}
                          </label>
                          <div className="flex gap-1.5">
                            {WEEKDAYS.map(d => {
                              const on = recurDays.includes(d.idx);
                              return (
                                <button key={d.idx} type="button"
                                  onClick={() => { setRecurDays(days => on ? days.filter(x => x !== d.idx) : [...days, d.idx].sort()); setFieldErrors(fe => ({ ...fe, days: undefined })); }}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                                  style={{
                                    background: on ? "var(--primary)" : "var(--elevated)",
                                    border: `1.5px solid ${on ? "var(--primary)" : "var(--border)"}`,
                                    color: on ? "#fff" : "var(--text-sec)",
                                  }}>
                                  {d.short}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                      {recurrence !== "none" && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                          <DateTimePicker
                            label="Повторять до"
                            value={recurUntil}
                            onChange={setRecurUntil}
                            dateOnly
                          />
                        </motion.div>
                      )}
                    </div>
                  )}

                  {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-xs rounded-xl px-3 py-2.5 font-medium"
                      style={{ background: errBg, border: `1px solid ${errBorder}`, color: errColor }}>
                      ⚠️ {error}
                    </motion.p>
                  )}

                  <div className="flex gap-2 pt-1">
                    {isEdit && canDelete && (
                      <motion.button type="button" onClick={() => setView("confirmDelete")}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        className="py-2.5 px-4 rounded-xl text-sm font-semibold"
                        style={{ border: `1.5px solid ${delBorder}`, color: errColor, background: delBg }}>
                        Удалить
                      </motion.button>
                    )}
                    <button type="button" onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{ border: "1.5px solid var(--border)", color: "var(--text-sec)", background: "var(--elevated)" }}>
                      Отмена
                    </button>
                    <motion.button type="submit" disabled={isCreating || isUpdating}
                      whileHover={{ scale: 1.02, boxShadow: "0 6px 24px rgba(124,58,237,0.4)" }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 16px rgba(124,58,237,0.25)" }}>
                      {(isCreating || isUpdating) ? "Сохраняем..." : isEdit ? "Сохранить" : "Забронировать"}
                    </motion.button>
                  </div>
                </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* canvas confetti is injected directly into document.body via useEffect */}
        </>
      )}
    </AnimatePresence>
  );
}
