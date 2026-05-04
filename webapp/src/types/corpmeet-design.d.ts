// Ambient декларации для CSS-импортов и tailwind-preset из @corpmeet/design.
// Для TS-модулей (theme и т.д.) используется paths-mapping в tsconfig +
// per-submodule shims в src/types/shims/.

declare module "@corpmeet/design/styles" {}
declare module "@corpmeet/design/styles/*" {}

declare module "@corpmeet/design/tailwind-preset" {
  const preset: unknown;
  export default preset;
}

declare module "@corpmeet/design/theme" {
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
}
