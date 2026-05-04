import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  isDark: false,
  toggle: () => {},
  setTheme: () => {},
});

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** localStorage key. Default: "corpmeet_theme". Override to avoid clashing with other apps. */
  storageKey?: string;
  /** Initial theme if storage is empty. Default: respect prefers-color-scheme. */
  defaultTheme?: Theme | "system";
}

export function ThemeProvider({
  children,
  storageKey = "corpmeet_theme",
  defaultTheme = "system",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem(storageKey) as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
    if (defaultTheme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return defaultTheme;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  const toggle = () => setThemeState((t) => (t === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider
      value={{ theme, isDark: theme === "dark", toggle, setTheme: setThemeState }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
