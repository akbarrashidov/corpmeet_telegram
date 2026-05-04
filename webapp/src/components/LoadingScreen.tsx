import { LoadingSpinner } from "@corpmeet/design/animations";

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <LoadingSpinner />
      {message && <p className="text-sm" style={{ color: "var(--text-sec)" }}>{message}</p>}
    </div>
  );
}
