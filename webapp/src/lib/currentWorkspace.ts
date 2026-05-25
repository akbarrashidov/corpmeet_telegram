import { useSyncExternalStore } from "react";

const KEY = "corpmeet_current_ws";
const listeners = new Set<() => void>();

function read(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setCurrentWorkspaceId(id: number | null) {
  try {
    if (id === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, String(id));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useCurrentWorkspaceId(): number | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
