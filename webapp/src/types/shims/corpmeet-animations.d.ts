import type { FC, CSSProperties } from "react";

export const LoadingSpinner: FC<{
  fullscreen?: boolean;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}>;

export const SplashScreen: FC<{ duration?: number; onDone?: () => void }>;
export const DotMatrixLogo: FC<{ word?: string; accentColor?: string; height?: number }>;
export const ParticleBackground: FC<{ className?: string }>;
export const InteractiveStripe: FC<{ position?: "top" | "bottom"; className?: string }>;
