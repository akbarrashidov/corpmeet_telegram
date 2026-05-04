import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { InteractiveStripe } from "../animations/InteractiveStripe";
import { MeetingListSkeleton } from "../components/Skeleton";
import { useTheme } from "../theme/ThemeContext";
import { useAdminBookings, useAdminStats, useAdminUsers } from "./hooks/useBookings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingsApi } from "./api/bookings";
import { usersApi } from "./api/users";
import { useAuth } from "./hooks/useAuth";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "stats" | "bookings" | "users";

const PALETTES = ["#7c3aed","#0891b2","#16a34a","#d97706","#e11d48","#c026d3","#4f46e5","#ea580c"];
function color(uid: number) { return PALETTES[uid % PALETTES.length]; }

function fmtRange(start: string, end: string) {
  const s = new Date(start).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const e = new Date(end).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${s} — ${e}`;
}

export function AdminPanel({ isOpen, onClose }: Props) {
  const { isDark } = useTheme();
  const [tab, setTab] = useState<Tab>("stats");

  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.role === "superadmin";
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: bookings = [], isLoading: bookingsLoading } = useAdminBookings();
  const { data: users = [], isLoading: usersLoading } = useAdminUsers();

  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteBookingTarget, setDeleteBookingTarget] = useState<{ id: number; title: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");

  const { mutate: setRole, variables: roleVars } = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: "user" | "admin" }) =>
      usersApi.adminSetRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const { mutate: createUser, isPending: creating } = useMutation({
    mutationFn: () => usersApi.adminCreateUser(newName.trim(), newUsername.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      setNewName(""); setNewUsername(""); setShowAddForm(false);
    },
  });

  const { mutate: deleteUser } = useMutation({
    mutationFn: (userId: number) => usersApi.adminDeleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const { mutate: deleteBooking } = useMutation({
    mutationFn: (bookingId: number) => bookingsApi.delete(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });

  const statCards = stats ? [
    { label: "Пользователей", value: stats.total_users, icon: "👤", color: "#7c3aed", goTo: "users" as Tab },
    { label: "Всего встреч", value: stats.total_bookings, icon: "📅", color: "#0891b2", goTo: "bookings" as Tab },
    { label: "Сейчас активно", value: stats.active_bookings, icon: "🟢", color: "#16a34a", goTo: "bookings" as Tab },
  ] : [];

  const roleBadge = (role: string) => {
    if (role === "superadmin") return { label: "superadmin", bg: "rgba(239,68,68,0.12)", color: "#ef4444" };
    if (role === "admin") return { label: "admin", bg: "rgba(124,58,237,0.12)", color: "var(--primary)" };
    return null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40" onClick={onClose}
            style={{ background: isDark ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.3)", backdropFilter: "blur(4px)" }} />

          <motion.div key="panel"
            initial={{ opacity: 0, x: 400 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 400 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
            style={{
              width: "min(420px, 100vw)",
              background: "var(--panel)",
              borderLeft: "1px solid var(--border)",
              boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.8)" : "-8px 0 40px rgba(15,23,42,0.12)",
            }}>

            <InteractiveStripe />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 mt-1"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Панель администратора</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {isSuperadmin ? "Суперадминистратор" : "Управление системой"}
                </p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-xl transition-all"
                style={{ color: "var(--text-muted)", background: "var(--elevated)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>×</button>
            </div>

            {/* Tabs */}
            <div className="flex px-4 pt-3 gap-2" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              {(["stats", "bookings", "users"] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: tab === t ? "var(--primary)" : "var(--elevated)",
                    border: `1.5px solid ${tab === t ? "var(--primary)" : "var(--border)"}`,
                    color: tab === t ? "#fff" : "var(--text-sec)",
                  }}>
                  {t === "stats" ? "Статистика" : t === "bookings" ? "Встречи" : "Пользователи"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">

              {/* Stats tab */}
              {tab === "stats" && (
                statsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-20 rounded-xl animate-pulse"
                        style={{ background: "var(--elevated)" }} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {statCards.map(s => (
                      <motion.div key={s.label}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setTab(s.goTo)}
                        className="rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all"
                        style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}>
                        <div className="text-3xl">{s.icon}</div>
                        <div className="flex-1">
                          <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.5 }}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </motion.div>
                    ))}
                  </div>
                )
              )}

              {/* Bookings tab */}
              {tab === "bookings" && (
                bookingsLoading ? <MeetingListSkeleton /> : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                      Последние {bookings.length} встреч
                    </p>
                    {bookings.map(b => {
                      const c = color(b.user_id);
                      return (
                        <div key={b.id} className="rounded-xl p-3" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-xs font-bold flex-1 min-w-0 truncate" style={{ color: "var(--text)" }}>{b.title}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                style={{ background: c }}>{b.user.display_name[0]}</div>
                              <button
                                onClick={() => setDeleteBookingTarget({ id: b.id, title: b.title })}
                                className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
                                style={{ color: "var(--text-muted)" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = ""; }}
                                title="Удалить встречу"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className="text-xs font-semibold" style={{ color: c }}>{fmtRange(b.start_time, b.end_time)}</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{b.user.display_name}</p>
                          {b.guests.length > 0 && (
                            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                              Гости: {b.guests.map(g => `@${g}`).join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* Users tab */}
              {tab === "users" && (
                usersLoading ? <MeetingListSkeleton /> : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                        {users.length} пользователей
                      </p>
                      <button onClick={() => setShowAddForm(v => !v)}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
                        style={{ background: "var(--primary)", color: "#fff" }}>
                        {showAddForm ? "Отмена" : "+ Добавить"}
                      </button>
                    </div>

                    {showAddForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="rounded-xl p-3 space-y-2"
                        style={{ background: "var(--elevated)", border: "1px solid var(--primary-border)" }}>
                        <input type="text" placeholder="Имя Фамилия" value={newName}
                          onChange={e => setNewName(e.target.value)}
                          className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                          style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }} />
                        <input type="text" placeholder="@username (необязательно)" value={newUsername}
                          onChange={e => setNewUsername(e.target.value)}
                          className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                          style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }} />
                        <button onClick={() => createUser()} disabled={!newName.trim() || creating}
                          className="w-full text-xs py-2 rounded-lg font-bold text-white disabled:opacity-40"
                          style={{ background: "var(--primary)" }}>
                          {creating ? "Создание..." : "Создать пользователя"}
                        </button>
                      </motion.div>
                    )}

                    {users.map(u => {
                      const c = color(u.id);
                      const badge = roleBadge(u.role);
                      return (
                        <div key={u.id} className="rounded-xl p-3 flex items-center gap-3"
                          style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                            style={{ background: c }}>{u.display_name[0]}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate" style={{ color: "var(--text)" }}>{u.display_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {u.username && (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>@{u.username}</span>
                              )}
                              {badge && (
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: badge.bg, color: badge.color }}>
                                  {badge.label}
                                </span>
                              )}
                            </div>
                          </div>
                          {u.id !== currentUser?.id && u.role !== "superadmin" && (
                            <div className="flex items-center gap-1 shrink-0">
                              {isSuperadmin && (
                                <button
                                  onClick={() => setRole({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })}
                                  disabled={roleVars?.userId === u.id}
                                  className="text-xs px-2 py-1 rounded-lg font-semibold transition-all disabled:opacity-40"
                                  style={u.role === "admin"
                                    ? { background: "rgba(124,58,237,0.12)", color: "var(--primary)", border: "1px solid var(--primary-border)" }
                                    : { background: "var(--elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }
                                  }
                                  title={u.role === "admin" ? "Снять admin" : "Дать admin"}
                                >
                                  {u.role === "admin" ? "admin ✕" : "+ admin"}
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteUserTarget({ id: u.id, name: u.display_name })}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-all"
                                style={{ color: "var(--text-muted)" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = ""; }}
                                title="Удалить пользователя"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </motion.div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteUserTarget}
        title="Удаление пользователя"
        message={`Вы уверены, что хотите удалить ${deleteUserTarget?.name ?? ""}? Все встречи этого пользователя будут отменены.`}
        confirmText="Удалить"
        cancelText="Отмена"
        danger
        onConfirm={() => { if (deleteUserTarget) deleteUser(deleteUserTarget.id); setDeleteUserTarget(null); }}
        onCancel={() => setDeleteUserTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteBookingTarget}
        title="Удаление встречи"
        message={`Удалить встречу "${deleteBookingTarget?.title ?? ""}"?`}
        confirmText="Удалить"
        cancelText="Отмена"
        danger
        onConfirm={() => { if (deleteBookingTarget) deleteBooking(deleteBookingTarget.id); setDeleteBookingTarget(null); }}
        onCancel={() => setDeleteBookingTarget(null)}
      />
    </AnimatePresence>
  );
}
