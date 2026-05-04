// Shim для @corpmeet/design/theme.
// Подменяет TS-source дизайн-пакета своим описанием типов, чтобы tsc
// не лез в .tsx файлы пакета, где не разрешается react из его location.
// Vite в рантайме всё так же резолвит реальный модуль через package.json exports.

import type { ReactNode, FC } from "react";

export type Theme = "light" | "dark";

export const ThemeProvider: FC<{
  children: ReactNode;
  defaultTheme?: Theme;
}>;

export function useTheme(): {
  theme: Theme;
  isDark: boolean;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
};

export const ThemeToggle: FC<{ className?: string }>;
