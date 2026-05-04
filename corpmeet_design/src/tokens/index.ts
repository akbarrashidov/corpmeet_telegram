/**
 * Design tokens as JS values.
 * For runtime usage when CSS variables aren't enough (e.g. canvas, inline styles in libs).
 * Source of truth is styles/tokens.css — keep these two in sync if you edit one.
 */

export const colors = {
  primary: "#6d28d9",
  primaryHover: "#5b21b6",
  accent: "#0ea5e9",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",

  light: {
    bg: "#e8ecf5",
    text: "#111827",
    textSec: "#374151",
    textMuted: "#6b7280",
    border: "rgba(200,208,226,0.6)",
  },
  dark: {
    bg: "#0b0f1a",
    text: "#f8fafc",
    textSec: "#cbd5e1",
    textMuted: "#94a3b8",
    border: "rgba(148,163,184,0.14)",
  },

  brand: {
    space: {
      950: "#0f172a",
      900: "#1e293b",
      800: "#263248",
      700: "#334155",
    },
    neon: {
      violet: "#6366f1",
      cyan: "#06b6d4",
      pink: "#ec4899",
    },
  },
} as const;

export const fonts = {
  sans: '"Manrope", system-ui, sans-serif',
  heading: '"Unbounded", "Manrope", system-ui, sans-serif',
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const shadows = {
  card: "0 2px 8px rgba(17,24,39,0.06), 0 4px 16px rgba(17,24,39,0.03)",
  panel: "-12px 0 40px rgba(17,24,39,0.10)",
  cardDark: "0 2px 10px rgba(0,0,0,0.35)",
  panelDark: "-8px 0 40px rgba(0,0,0,0.45)",
  glowPrimary: "0 0 14px rgba(139,92,246,0.55)",
} as const;

export const motion = {
  spring: { type: "spring", damping: 22, stiffness: 280 } as const,
  springSoft: { type: "spring", damping: 28, stiffness: 180 } as const,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
} as const;

export const layout = {
  hourHeightPx: 56,
  dayStartHour: 8,
  dayEndHour: 22,
  totalHours: 14,
} as const;
