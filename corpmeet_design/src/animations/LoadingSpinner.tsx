import { motion } from "framer-motion";

export interface LoadingSpinnerProps {
  /** Render fullscreen with bg color. Default: true. */
  fullscreen?: boolean;
  size?: number;
}

export function LoadingSpinner({ fullscreen = true, size = 40 }: LoadingSpinnerProps) {
  const spinner = (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="rounded-full border-2"
      style={{
        width: size,
        height: size,
        borderColor: "var(--primary)",
        borderTopColor: "transparent",
      }}
    />
  );
  if (!fullscreen) return spinner;
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      {spinner}
    </div>
  );
}

export default LoadingSpinner;
